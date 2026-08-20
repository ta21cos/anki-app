#!/usr/bin/env bun
/**
 * e2e テストが Turso に残した owner（X-Dev-Owner: e2e-<uuid>）のデッキとカードを削除する。
 *
 * Usage:
 *   source .env.local && bun scripts/cleanup-e2e-data.ts
 */

import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error("TURSO_DATABASE_URL が設定されていません (.env.local を確認)");
  process.exit(1);
}

const client = createClient({ url, authToken });

async function main() {
  const cards = await client.execute(
    "DELETE FROM cards WHERE owner_id LIKE 'e2e-%'",
  );
  const decks = await client.execute(
    "DELETE FROM decks WHERE owner_id LIKE 'e2e-%'",
  );
  console.log(
    `削除: カード ${cards.rowsAffected} 枚 / デッキ ${decks.rowsAffected} 件`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
