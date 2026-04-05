import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/server/db";
import { cards } from "@/lib/server/schema";
import { getDeviceId } from "@/lib/server/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const db = getDb();
  const deviceId = getDeviceId(request);
  const { cardId } = await params;
  const body = await request.json();

  await db
    .update(cards)
    .set(body)
    .where(and(eq(cards.id, cardId), eq(cards.deviceId, deviceId)));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const db = getDb();
  const deviceId = getDeviceId(request);
  const { cardId } = await params;

  await db
    .delete(cards)
    .where(and(eq(cards.id, cardId), eq(cards.deviceId, deviceId)));

  return NextResponse.json({ ok: true });
}
