import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

let _client: Client | null = null;
let _db: LibSQLDatabase<typeof schema> | null = null;

export function getDb() {
  if (!_db) {
    _client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    _db = drizzle(_client, { schema });
  }
  return _db;
}
