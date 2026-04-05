import { NextResponse } from "next/server";
import { and, asc, eq, lte } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { cards } from "@/lib/server/schema";
import { getDeviceId } from "@/lib/server/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ deckId: string }> },
) {
  const deviceId = getDeviceId(request);
  const { deckId } = await params;
  const url = new URL(request.url);
  const dueBefore = url.searchParams.get("due_before");

  const conditions = [eq(cards.deviceId, deviceId), eq(cards.deckId, deckId)];
  if (dueBefore) {
    conditions.push(lte(cards.due, Number(dueBefore)));
  }

  const result = await db
    .select()
    .from(cards)
    .where(and(...conditions))
    .orderBy(asc(cards.due));

  return NextResponse.json(result);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ deckId: string }> },
) {
  const deviceId = getDeviceId(request);
  const { deckId } = await params;
  const body = await request.json();

  const card = {
    id: body.id ?? crypto.randomUUID(),
    deviceId,
    deckId,
    front: body.front,
    back: body.back,
    due: body.due,
    stability: body.stability,
    difficulty: body.difficulty,
    reps: body.reps,
    lapses: body.lapses,
    state: body.state,
    lastReview: body.lastReview ?? null,
    createdAt: body.createdAt,
  };

  await db.insert(cards).values(card);
  return NextResponse.json(card, { status: 201 });
}
