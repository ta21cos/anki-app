import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { cards, decks } from "@/lib/server/schema";
import { getDeviceId } from "@/lib/server/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ deckId: string }> },
) {
  const deviceId = getDeviceId(request);
  const { deckId } = await params;
  const [deck] = await db
    .select()
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.deviceId, deviceId)));
  if (!deck) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(deck);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ deckId: string }> },
) {
  const deviceId = getDeviceId(request);
  const { deckId } = await params;
  const body = await request.json();
  await db
    .update(decks)
    .set(body)
    .where(and(eq(decks.id, deckId), eq(decks.deviceId, deviceId)));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ deckId: string }> },
) {
  const deviceId = getDeviceId(request);
  const { deckId } = await params;
  await db
    .delete(cards)
    .where(and(eq(cards.deckId, deckId), eq(cards.deviceId, deviceId)));
  await db
    .delete(decks)
    .where(and(eq(decks.id, deckId), eq(decks.deviceId, deviceId)));
  return NextResponse.json({ ok: true });
}
