#!/usr/bin/env bun
/**
 * drizzle/ 配下の migration を Turso に適用する。
 *
 * Usage:
 *   source .env.local && bun scripts/migrate.ts
 *
 * 0000_init は migration 導入前に手作業で作られていた本番スキーマと同一なので、
 * `decks` テーブルが既に存在し migration 履歴が空の DB では 0000 を「適用済み」
 * として履歴に登録してから、残りの migration だけを実行する。
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";

const MIGRATIONS_FOLDER = "./drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error("TURSO_DATABASE_URL が設定されていません (.env.local を確認)");
  process.exit(1);
}

const client = createClient({ url, authToken });
const db = drizzle(client);

async function baselineIfNeeded(): Promise<void> {
  const decksExists = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'decks'",
  );
  if (decksExists.rows.length === 0) return;

  await client.execute(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`,
  );
  const applied = await client.execute(
    `SELECT count(*) AS n FROM ${MIGRATIONS_TABLE}`,
  );
  if (Number(applied.rows[0].n) > 0) return;

  const [initial] = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
  await client.execute({
    sql: `INSERT INTO ${MIGRATIONS_TABLE} (hash, created_at) VALUES (?, ?)`,
    args: [initial.hash, initial.folderMillis],
  });
  console.log("baseline: 0000 を適用済みとして登録しました");
}

async function main() {
  await baselineIfNeeded();
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  const rows = await client.execute(
    `SELECT hash, created_at FROM ${MIGRATIONS_TABLE} ORDER BY created_at`,
  );
  console.log(`適用済み migration: ${rows.rows.length} 件`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
