import { db } from "@/lib/db";

export async function mergeDecks(
  targetDeckId: string,
  sourceDeckIds: string[],
): Promise<number> {
  let movedCount = 0;

  await db.transaction("rw", db.decks, db.cards, async () => {
    for (const sourceId of sourceDeckIds) {
      if (sourceId === targetDeckId) continue;

      const cards = await db.cards.where("deckId").equals(sourceId).toArray();
      for (const card of cards) {
        await db.cards.update(card.id, { deckId: targetDeckId });
        movedCount++;
      }

      await db.decks.delete(sourceId);
    }
  });

  return movedCount;
}
