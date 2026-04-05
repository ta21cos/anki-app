#!/usr/bin/env bun
/**
 * TSV/CSV ファイルを Turso DB に直接インポートするスクリプト
 *
 * Usage:
 *   bun scripts/import-tsv.ts <file-path> [deck-name]
 *
 * - deck-name を省略するとファイル名がデッキ名になる
 * - 既存のデバイス ID が1つならそれを使う、2つ以上なら選択
 */

import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { basename } from "path";
import { createInterface } from "readline";

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_DATABASE_URL) {
  console.error("TURSO_DATABASE_URL が設定されていません (.env.local を確認)");
  process.exit(1);
}

const client = createClient({
  url: TURSO_DATABASE_URL,
  authToken: TURSO_AUTH_TOKEN,
});

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: bun scripts/import-tsv.ts <file-path> [deck-name]");
  process.exit(1);
}

const deckName =
  process.argv[3] ?? basename(filePath).replace(/\.(tsv|csv|txt)$/i, "");

function parseTsv(content: string): { front: string; back: string }[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const tabIndex = line.indexOf("\t");
      if (tabIndex === -1) return null;
      const front = line.slice(0, tabIndex).trim();
      const back = line.slice(tabIndex + 1).trim();
      if (!front || !back) return null;
      return { front, back };
    })
    .filter((card): card is { front: string; back: string } => card !== null);
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function getDeviceId(): Promise<string> {
  const result = await client.execute(
    "SELECT DISTINCT device_id FROM decks UNION SELECT DISTINCT device_id FROM cards",
  );
  const ids = result.rows.map((r) => r.device_id as string);
  const unique = [...new Set(ids)];

  if (unique.length === 0) {
    console.error(
      "DB にデバイス ID が見つかりません。先にアプリからインポートしてください。",
    );
    process.exit(1);
  }

  if (unique.length === 1) {
    console.log(`デバイス ID: ${unique[0]}`);
    return unique[0];
  }

  console.log("複数のデバイス ID が見つかりました:");
  unique.forEach((id, i) => console.log(`  ${i + 1}. ${id}`));
  const choice = await prompt("番号を選択: ");
  const index = parseInt(choice, 10) - 1;
  if (index < 0 || index >= unique.length) {
    console.error("無効な選択です");
    process.exit(1);
  }
  return unique[index];
}

async function main() {
  const content = readFileSync(filePath, "utf-8");
  const cards = parseTsv(content);

  if (cards.length === 0) {
    console.error("有効なカードが見つかりません");
    process.exit(1);
  }

  console.log(`ファイル: ${filePath}`);
  console.log(`カード数: ${cards.length}`);
  console.log(`デッキ名: ${deckName}`);

  const deviceId = await getDeviceId();
  const now = Date.now();
  const deckId = crypto.randomUUID();

  await client.execute({
    sql: "INSERT INTO decks (id, device_id, name, created_at) VALUES (?, ?, ?, ?)",
    args: [deckId, deviceId, deckName, now],
  });

  const batchSize = 50;
  for (let i = 0; i < cards.length; i += batchSize) {
    const batch = cards.slice(i, i + batchSize);
    const stmts = batch.map((card) => ({
      sql: "INSERT INTO cards (id, device_id, deck_id, front, back, due, stability, difficulty, reps, lapses, state, last_review, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, NULL, ?)",
      args: [
        crypto.randomUUID(),
        deviceId,
        deckId,
        card.front,
        card.back,
        now,
        now,
      ],
    }));
    await client.batch(stmts);
  }

  console.log(
    `\n${cards.length} 枚のカードを「${deckName}」にインポートしました`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
