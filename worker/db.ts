import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql/web";
import type { LibSQLDatabase } from "drizzle-orm/libsql/driver-core";
import * as schema from "./schema";

export type Env = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN?: string;
  CF_ACCESS_TEAM?: string;
  CF_ACCESS_AUD?: string;
  CF_ACCESS_AUD_PREVIEW?: string;
  DEV_OWNER_ID?: string;
};

const cache: { db: LibSQLDatabase<typeof schema> | null } = { db: null };

export function getDb(env: Env) {
  if (!cache.db) {
    const client = createClient({
      url: env.TURSO_DATABASE_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    });
    cache.db = drizzle(client, { schema });
  }
  return cache.db;
}
