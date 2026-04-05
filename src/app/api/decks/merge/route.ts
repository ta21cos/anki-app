import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/server/db";
import { cards, decks } from "@/lib/server/schema";
import { getDeviceId } from "@/lib/server/auth";

export async function POST(request: Request) {
  const db = getDb();
  const deviceId = getDeviceId(request);
  const { targetDeckId, sourceDeckIds } = (await request.json()) as {
    targetDeckId: string;
    sourceDeckIds: string[];
  };

  const toMerge = sourceDeckIds.filter((id) => id !== targetDeckId);
  if (toMerge.length === 0) {
    return NextResponse.json({ movedCount: 0 });
  }

  await db
    .update(cards)
    .set({ deckId: targetDeckId })
    .where(and(eq(cards.deviceId, deviceId), inArray(cards.deckId, toMerge)));

  await db
    .delete(decks)
    .where(and(eq(decks.deviceId, deviceId), inArray(decks.id, toMerge)));

  return NextResponse.json({ ok: true });
}
