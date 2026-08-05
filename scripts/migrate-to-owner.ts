#!/usr/bin/env bun
/**
 * device_id → owner_id 移行スクリプト（1 回だけ実行する）
 *
 * Usage:
 *   bun scripts/migrate-to-owner.ts <email>
 *
 * 実行内容:
 *   1. device_id 系 index を削除する
 *   2. decks / cards の device_id カラムを owner_id に改名する
 *   3. owner_id 系 index を作り直す
 *   4. 全行の owner_id を Cloudflare Access のログインメールアドレスに書き換える
 *
 * 冪等性: カラムが既に owner_id なら 1〜3 を飛ばし、4 のみ実行する。
 */

import { createClient } from "@libsql/client";

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_DATABASE_URL) {
  console.error("TURSO_DATABASE_URL が設定されていません (.env.local を確認)");
  process.exit(1);
}

const email = process.argv[2];
if (!email || !email.includes("@")) {
  console.error("Usage: bun scripts/migrate-to-owner.ts <email>");
  console.error(
    "email には Cloudflare Access でログインするメールアドレスを指定する",
  );
  process.exit(1);
}

const client = createClient({
  url: TURSO_DATABASE_URL,
  authToken: TURSO_AUTH_TOKEN,
});

async function hasColumn(table: string, column: string): Promise<boolean> {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  return result.rows.some((row) => row.name === column);
}

async function main() {
  const alreadyMigrated = await hasColumn("decks", "owner_id");

  if (alreadyMigrated) {
    console.log("カラムは既に owner_id です。値の更新のみ行います。");
  } else {
    console.log("スキーマを移行します...");
    await client.batch([
      "DROP INDEX IF EXISTS decks_device_id_idx",
      "DROP INDEX IF EXISTS cards_device_deck_idx",
      "DROP INDEX IF EXISTS cards_device_due_idx",
      "DROP INDEX IF EXISTS cards_device_state_idx",
      "DROP INDEX IF EXISTS cards_device_deck_due_idx",
      "ALTER TABLE decks RENAME COLUMN device_id TO owner_id",
      "ALTER TABLE cards RENAME COLUMN device_id TO owner_id",
      "CREATE INDEX IF NOT EXISTS decks_owner_idx ON decks (owner_id)",
      "CREATE INDEX IF NOT EXISTS cards_owner_deck_idx ON cards (owner_id, deck_id)",
      "CREATE INDEX IF NOT EXISTS cards_owner_due_idx ON cards (owner_id, due)",
      "CREATE INDEX IF NOT EXISTS cards_owner_state_idx ON cards (owner_id, state)",
      "CREATE INDEX IF NOT EXISTS cards_owner_deck_due_idx ON cards (owner_id, deck_id, due)",
    ]);
    console.log("スキーマ移行が完了しました。");
  }

  const owners = await client.execute(
    "SELECT DISTINCT owner_id FROM decks UNION SELECT DISTINCT owner_id FROM cards",
  );
  console.log(
    `既存の owner: ${owners.rows.map((row) => row.owner_id).join(", ") || "(なし)"}`,
  );

  const deckResult = await client.execute({
    sql: "UPDATE decks SET owner_id = ?",
    args: [email],
  });
  const cardResult = await client.execute({
    sql: "UPDATE cards SET owner_id = ?",
    args: [email],
  });

  console.log(
    `owner_id を ${email} に更新しました (decks: ${deckResult.rowsAffected} 行, cards: ${cardResult.rowsAffected} 行)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
