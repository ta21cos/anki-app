import { NextResponse } from "next/server";
import { and, count, eq, lte } from "drizzle-orm";
import { getDb } from "@/lib/server/db";
import { cards } from "@/lib/server/schema";
import { getDeviceId } from "@/lib/server/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ deckId: string }> },
) {
  const db = getDb();
  const deviceId = getDeviceId(request);
  const { deckId } = await params;
  const url = new URL(request.url);
  const dueBefore = url.searchParams.get("due_before");

  const conditions = [eq(cards.deviceId, deviceId), eq(cards.deckId, deckId)];
  if (dueBefore) {
    conditions.push(lte(cards.due, Number(dueBefore)));
  }

  const [result] = await db
    .select({ count: count() })
    .from(cards)
    .where(and(...conditions));

  return NextResponse.json({ count: result.count });
}
