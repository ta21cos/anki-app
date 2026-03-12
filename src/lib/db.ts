import Dexie, { type EntityTable } from "dexie";

export interface Deck {
  id: string;
  name: string;
  createdAt: number;
}

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  due: number;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: number | null;
  createdAt: number;
}

class AnkiDatabase extends Dexie {
  decks!: EntityTable<Deck, "id">;
  cards!: EntityTable<Card, "id">;

  constructor() {
    super("anki-pwa");
    this.version(1).stores({
      decks: "id, name, createdAt",
      cards: "id, deckId, due, state, createdAt, [deckId+due], [deckId+state]",
    });
  }
}

export const db = new AnkiDatabase();
