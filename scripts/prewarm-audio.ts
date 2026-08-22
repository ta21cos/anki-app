#!/usr/bin/env bun
/**
 * カードの読み上げ音声を事前に合成し、Worker が使う KV へ入れておくスクリプト。
 *
 * Usage:
 *   source .env.local && bun scripts/prewarm-audio.ts                    # 不足数を数えるだけ
 *   source .env.local && bun scripts/prewarm-audio.ts --sample 6         # 試聴用に mp3 を書き出す
 *   source .env.local && bun scripts/prewarm-audio.ts --apply            # 不足分を合成して KV へ入れる
 *   source .env.local && bun scripts/prewarm-audio.ts --deck-like 'チャンク::%' --apply
 *
 * 音声クイズは初回だけ合成に 30 秒〜1 分かかる。先に入れておくと待ち時間が消える。
 * キーの作り方と TTS のパラメータは worker/audio.ts と一致させること。ずれると
 * キャッシュに当たらず、アプリ側が同じテキストをもう一度合成してしまう。
 */

import { createClient } from "@libsql/client";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TTS_MODEL = "gpt-4o-mini-tts";
const TTS_VOICE = "alloy";
const TTS_INSTRUCTIONS: Record<string, string> = {
  en: "Speak clearly in natural American English at a moderate pace.",
  ja: "自然な日本語で、はっきりと落ち着いた速さで読み上げてください。",
};
const KV_NAMESPACE_ID = "1a281d8758e04f978da6526581758037";
const CONCURRENCY = 8;
const UPLOAD_BATCH = 50;
const SAMPLE_DIR = "audio-samples";
const MP3_BYTES_PER_SECOND = 16000;

function argValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

const isApplyRequested = process.argv.includes("--apply");
const sampleCount = Number(argValue("--sample") ?? 0);
const deckLike = argValue("--deck-like") ?? "%";

const databaseUrl = process.env.TURSO_DATABASE_URL;
if (!databaseUrl) {
  console.error("TURSO_DATABASE_URL が設定されていません (.env.local を確認)");
  process.exit(1);
}
const openaiKey = process.env.OPENAI_API_KEY;
if ((isApplyRequested || sampleCount > 0) && !openaiKey) {
  console.error(
    "OPENAI_API_KEY が設定されていません。合成するには .env.local に追加してください",
  );
  process.exit(1);
}

const client = createClient({
  url: databaseUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

type Segment = { key: string; text: string; lang: string };
type Synthesized = { key: string; bytes: Uint8Array };

async function segmentKey(text: string, lang: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${TTS_MODEL}|${TTS_VOICE}|${lang}|${text}`),
  );
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `seg/${hex}.mp3`;
}

async function synthesize(text: string, lang: string): Promise<Uint8Array> {
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: text,
      instructions: TTS_INSTRUCTIONS[lang],
      response_format: "mp3",
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 200);
    throw new Error(`TTS failed: ${response.status} ${detail}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function runWrangler(args: string[]): string {
  return execFileSync("bunx", ["wrangler", ...args], {
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
    env: process.env,
  });
}

function listExistingKeys(): Set<string> {
  const stdout = runWrangler([
    "kv",
    "key",
    "list",
    "--namespace-id",
    KV_NAMESPACE_ID,
    "--remote",
  ]);
  const listed = JSON.parse(stdout.slice(stdout.indexOf("["))) as Array<{
    name: string;
  }>;
  return new Set(listed.map((row) => row.name));
}

function uploadToKv(entries: Synthesized[]): void {
  const directory = join(
    tmpdir(),
    `prewarm-${process.pid}-${entries[0].key.slice(4, 12)}`,
  );
  mkdirSync(directory, { recursive: true });
  const path = join(directory, "bulk.json");
  // NOTE: key / value / base64 は wrangler kv bulk put が要求するフィールド名。
  writeFileSync(
    path,
    JSON.stringify(
      entries.map((segment) => ({
        key: segment.key,
        value: Buffer.from(segment.bytes).toString("base64"),
        base64: true,
      })),
    ),
  );
  runWrangler([
    "kv",
    "bulk",
    "put",
    path,
    "--namespace-id",
    KV_NAMESPACE_ID,
    "--remote",
  ]);
  rmSync(directory, { recursive: true, force: true });
}

// NOTE: OpenAI へ同時に投げる本数を絞る。全件を一度に走らせるとレート制限に当たる。
async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const cursor = { next: 0 };
  const worker = async () => {
    for (;;) {
      const index = cursor.next++;
      if (index >= items.length) return;
      results[index] = await run(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

function chunk<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

async function collectSegments(): Promise<{
  cardCount: number;
  segments: Segment[];
}> {
  const rows = await client.execute({
    sql: `SELECT c.front, c.back, d.front_lang, d.back_lang
          FROM cards c JOIN decks d ON d.id = c.deck_id
          WHERE d.name LIKE ?`,
    args: [deckLike],
  });

  const segments: Segment[] = [];
  const seenKeys = new Set<string>();
  for (const row of rows.rows) {
    const sides: Array<[string, string]> = [
      [row.front as string, row.front_lang as string],
      [row.back as string, row.back_lang as string],
    ];
    for (const [text, lang] of sides) {
      const key = await segmentKey(text, lang);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      segments.push({ key, text, lang });
    }
  }
  return { cardCount: rows.rows.length, segments };
}

async function writeSamples(missing: Segment[]): Promise<void> {
  mkdirSync(SAMPLE_DIR, { recursive: true });
  const picks = [
    ...missing
      .filter((segment) => segment.lang === "ja")
      .slice(0, Math.ceil(sampleCount / 2)),
    ...missing
      .filter((segment) => segment.lang === "en")
      .slice(0, Math.floor(sampleCount / 2)),
  ];
  for (const [index, segment] of picks.entries()) {
    const bytes = await synthesize(segment.text, segment.lang);
    const file = join(SAMPLE_DIR, `${index + 1}-${segment.lang}.mp3`);
    writeFileSync(file, bytes);
    console.log(`  ${file}  ${segment.text.slice(0, 40)}`);
  }
  console.log(
    `\n${picks.length} 本を ${SAMPLE_DIR}/ に書き出しました（KV には入れていません）`,
  );
}

async function main() {
  const { cardCount, segments } = await collectSegments();
  console.log(`対象デッキ: ${deckLike}`);
  console.log(`カード ${cardCount} 枚 → セグメント ${segments.length} 本`);

  const existingKeys = listExistingKeys();
  const missing = segments.filter((segment) => !existingKeys.has(segment.key));
  console.log(
    `KV に既存 ${segments.length - missing.length} 本 / 不足 ${missing.length} 本`,
  );

  if (sampleCount > 0) {
    await writeSamples(missing);
    return;
  }
  if (!isApplyRequested) {
    console.log("\n(--apply で不足分を合成して KV へ入れます)");
    return;
  }
  if (missing.length === 0) {
    console.log("\n不足はありません");
    return;
  }

  const progress = { count: 0 };
  const synthesized = await mapWithLimit(
    missing,
    CONCURRENCY,
    async (segment): Promise<Synthesized> => {
      const bytes = await synthesize(segment.text, segment.lang);
      progress.count += 1;
      if (progress.count % 25 === 0) {
        console.log(`  合成 ${progress.count}/${missing.length}`);
      }
      return { key: segment.key, bytes };
    },
  );

  const batches = chunk(synthesized, UPLOAD_BATCH);
  for (const [index, batch] of batches.entries()) {
    uploadToKv(batch);
    console.log(`  KV へ書き込み ${index + 1}/${batches.length} バッチ`);
  }

  const totalSeconds =
    synthesized.reduce((sum, segment) => sum + segment.bytes.byteLength, 0) /
    MP3_BYTES_PER_SECOND;
  console.log(
    `\n${synthesized.length} 本を KV へ入れました（音声 ${Math.round(totalSeconds / 60)} 分ぶん）`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
