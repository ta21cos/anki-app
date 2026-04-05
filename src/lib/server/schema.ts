import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const decks = sqliteTable(
  "decks",
  {
    id: text("id").primaryKey(),
    deviceId: text("device_id").notNull(),
    name: text("name").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("decks_device_id_idx").on(table.deviceId)],
);

export const cards = sqliteTable(
  "cards",
  {
    id: text("id").primaryKey(),
    deviceId: text("device_id").notNull(),
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
    index("cards_device_deck_idx").on(table.deviceId, table.deckId),
    index("cards_device_due_idx").on(table.deviceId, table.due),
    index("cards_device_state_idx").on(table.deviceId, table.state),
    index("cards_device_deck_due_idx").on(
      table.deviceId,
      table.deckId,
      table.due,
    ),
  ],
);
