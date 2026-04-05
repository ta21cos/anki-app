import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { cards, decks } from "@/lib/server/schema";
import { getDeviceId } from "@/lib/server/auth";

export async function GET(request: Request) {
  const deviceId = getDeviceId(request);
  const result = await db
    .select()
    .from(decks)
    .where(eq(decks.deviceId, deviceId));
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const deviceId = getDeviceId(request);
  const body = await request.json();
  const { deck, cards: cardList } = body as {
    deck: { id: string; name: string; createdAt: number };
    cards: Array<{
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
    }>;
  };

  await db.insert(decks).values({
    id: deck.id,
    deviceId,
    name: deck.name,
    createdAt: deck.createdAt,
  });

  if (cardList.length > 0) {
    await db.insert(cards).values(
      cardList.map((c) => ({
        ...c,
        deviceId,
      })),
    );
  }

  return NextResponse.json({ id: deck.id }, { status: 201 });
}
