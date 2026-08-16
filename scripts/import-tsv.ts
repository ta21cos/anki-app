#!/usr/bin/env bun
/**
 * TSV/CSV ファイルを Turso DB に直接インポートするスクリプト
 *
 * Usage:
 *   bun scripts/import-tsv.ts <file-path> [deck-name] [--front-lang ja|en] [--back-lang ja|en] [--append]
 *
 * - deck-name を省略するとファイル名がデッキ名になる
 * - --front-lang / --back-lang を省略すると英語（en）になる
 * - --append を付けると、同名の既存デッキにカードを追加する（裏面が同じカードはスキップ）。
 *   既存デッキがなければ新規作成する
 * - 既存のowner が1つならそれを使う、2つ以上なら選択
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

const LANGS = ["en", "ja"] as const;
type Lang = (typeof LANGS)[number];

function parseArgs(argv: string[]): {
  filePath: string;
  deckName: string;
  frontLang: Lang;
  backLang: Lang;
  append: boolean;
} {
  const positional: string[] = [];
  const flags = { append: false };
  const langs: { frontLang: Lang; backLang: Lang } = {
    frontLang: "en",
    backLang: "en",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--append") {
      flags.append = true;
      continue;
    }
    if (arg === "--front-lang" || arg === "--back-lang") {
      const value = argv[i + 1];
      if (!(LANGS as readonly string[]).includes(value)) {
        console.error(`${arg} には ${LANGS.join(" | ")} を指定してください`);
        process.exit(1);
      }
      langs[arg === "--front-lang" ? "frontLang" : "backLang"] = value as Lang;
      i += 1;
      continue;
    }
    positional.push(arg);
  }
  const [filePath, deckNameArg] = positional;
  if (!filePath) {
    console.error(
      "Usage: bun scripts/import-tsv.ts <file-path> [deck-name] [--front-lang ja|en] [--back-lang ja|en] [--append]",
    );
    process.exit(1);
  }
  return {
    filePath,
    deckName:
      deckNameArg ?? basename(filePath).replace(/\.(tsv|csv|txt)$/i, ""),
    ...langs,
    ...flags,
  };
}

const { filePath, deckName, frontLang, backLang, append } = parseArgs(
  process.argv.slice(2),
);

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

async function getOwnerId(): Promise<string> {
  const result = await client.execute(
    "SELECT DISTINCT owner_id FROM decks UNION SELECT DISTINCT owner_id FROM cards",
  );
  const ids = result.rows.map((r) => r.owner_id as string);
  const unique = [...new Set(ids)];

  if (unique.length === 0) {
    console.error(
      "DB にowner が見つかりません。先にアプリからインポートしてください。",
    );
    process.exit(1);
  }

  if (unique.length === 1) {
    console.log(`owner: ${unique[0]}`);
    return unique[0];
  }

  console.log("複数のowner が見つかりました:");
  unique.forEach((id, i) => console.log(`  ${i + 1}. ${id}`));
  const choice = await prompt("番号を選択: ");
  const index = parseInt(choice, 10) - 1;
  if (index < 0 || index >= unique.length) {
    console.error("無効な選択です");
    process.exit(1);
  }
  return unique[index];
}

function normalizeBack(back: string): string {
  return back
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "");
}

async function findDeck(
  ownerId: string,
  name: string,
): Promise<{ id: string; cardCount: number } | null> {
  const result = await client.execute({
    sql: "SELECT d.id AS id, (SELECT count(*) FROM cards c WHERE c.deck_id = d.id) AS card_count FROM decks d WHERE d.owner_id = ? AND d.name = ? ORDER BY d.created_at LIMIT 1",
    args: [ownerId, name],
  });
  const row = result.rows[0];
  if (!row) return null;
  return { id: row.id as string, cardCount: Number(row.card_count) };
}

async function loadExistingBacks(
  ownerId: string,
  deckId: string,
): Promise<Set<string>> {
  const result = await client.execute({
    sql: "SELECT back FROM cards WHERE owner_id = ? AND deck_id = ?",
    args: [ownerId, deckId],
  });
  return new Set(result.rows.map((row) => normalizeBack(row.back as string)));
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
  console.log(`読み上げ言語: 表 ${frontLang} / 裏 ${backLang}`);

  const ownerId = await getOwnerId();
  const now = Date.now();
  const existingDeck = append ? await findDeck(ownerId, deckName) : null;
  const deckId = existingDeck?.id ?? crypto.randomUUID();

  if (existingDeck) {
    console.log(`既存デッキに追加します (${existingDeck.cardCount} 枚あり)`);
  } else {
    await client.execute({
      sql: "INSERT INTO decks (id, owner_id, name, created_at, front_lang, back_lang) VALUES (?, ?, ?, ?, ?, ?)",
      args: [deckId, ownerId, deckName, now, frontLang, backLang],
    });
  }

  const existingBacks = existingDeck
    ? await loadExistingBacks(ownerId, deckId)
    : new Set<string>();
  const newCards = cards.filter(
    (card) => !existingBacks.has(normalizeBack(card.back)),
  );
  const skipped = cards.length - newCards.length;
  if (skipped > 0) {
    console.log(`裏面が重複する ${skipped} 枚をスキップします`);
  }

  const batchSize = 50;
  for (let i = 0; i < newCards.length; i += batchSize) {
    const batch = newCards.slice(i, i + batchSize);
    // due をファイル内の行順に 1ms ずつずらし、期限順で並べたときに
    // 教材の順序（レッスン順）が保たれるようにする
    const stmts = batch.map((card, offset) => ({
      sql: "INSERT INTO cards (id, owner_id, deck_id, front, back, due, stability, difficulty, reps, lapses, state, last_review, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, NULL, ?)",
      args: [
        crypto.randomUUID(),
        ownerId,
        deckId,
        card.front,
        card.back,
        now + i + offset,
        now,
      ],
    }));
    await client.batch(stmts);
  }

  console.log(
    `\n${newCards.length} 枚のカードを「${deckName}」にインポートしました`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
