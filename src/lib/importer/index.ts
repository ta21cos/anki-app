import { db, type Card, type Deck } from "@/lib/db";
import { parseTxt, type ParsedCard } from "./txt";
import { parseCsv } from "./csv";
import { parseApkg } from "./apkg";

export interface ImportResult {
  deckName: string;
  importedCount: number;
  skippedCount: number;
}

export async function importFile(
  file: File,
  deckName: string,
): Promise<ImportResult> {
  const lastDot = file.name.lastIndexOf(".");
  const ext =
    lastDot > 0 ? file.name.slice(lastDot + 1).toLowerCase() : undefined;
  let parsedCards: ParsedCard[];

  switch (ext) {
    case "txt":
    case "tsv":
      parsedCards = parseTxt(await file.text());
      break;
    case "csv":
      parsedCards = parseCsv(await file.text());
      break;
    case "apkg":
      parsedCards = await parseApkg(await file.arrayBuffer());
      break;
    default:
      throw new Error(
        `未対応のファイル形式です: .${ext}（.txt, .tsv, .csv, .apkg に対応）`,
      );
  }

  const now = Date.now();
  const deckId = crypto.randomUUID();
  const deck: Deck = {
    id: deckId,
    name: deckName,
    createdAt: now,
  };

  const cards: Card[] = parsedCards.map((card) => ({
    id: crypto.randomUUID(),
    deckId,
    front: card.front,
    back: card.back,
    due: now,
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    lastReview: null,
    createdAt: now,
  }));

  await db.transaction("rw", db.decks, db.cards, async () => {
    await db.decks.add(deck);
    await db.cards.bulkAdd(cards);
  });

  return {
    deckName,
    importedCount: cards.length,
    skippedCount: parsedCards.length - cards.length,
  };
}
