import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

// NOTE: 読み上げ言語。表裏それぞれの TTS / Web Speech のロケール選択に使う。
export const LANGS = ["en", "ja"] as const;
export type Lang = (typeof LANGS)[number];

export function isLang(value: unknown): value is Lang {
  return (
    typeof value === "string" && (LANGS as readonly string[]).includes(value)
  );
}

export const decks = sqliteTable(
  "decks",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    includeInDaily: integer("include_in_daily", { mode: "boolean" })
      .notNull()
      .default(true),
    frontLang: text("front_lang", { enum: LANGS }).notNull().default("en"),
    backLang: text("back_lang", { enum: LANGS }).notNull().default("en"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("decks_owner_idx").on(table.ownerId)],
);

export const cards = sqliteTable(
  "cards",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    deckId: text("deck_id").notNull(),
    front: text("front").notNull(),
    back: text("back").notNull(),
    due: integer("due").notNull(),
    stability: real("stability").notNull(),
    difficulty: real("difficulty").notNull(),
    reps: integer("reps").notNull(),
    lapses: integer("lapses").notNull(),
    state: integer("state").notNull(),
    lastReview: integer("last_review"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("cards_owner_deck_idx").on(table.ownerId, table.deckId),
    index("cards_owner_due_idx").on(table.ownerId, table.due),
    index("cards_owner_state_idx").on(table.ownerId, table.state),
    index("cards_owner_deck_due_idx").on(
      table.ownerId,
      table.deckId,
      table.due,
    ),
  ],
);
