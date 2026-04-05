import { NextResponse } from "next/server";
import { and, count, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "@/lib/server/db";
import { cards, decks } from "@/lib/server/schema";
import { getDeviceId } from "@/lib/server/auth";

export async function GET(request: Request) {
  const deviceId = getDeviceId(request);
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const deviceFilter = eq(cards.deviceId, deviceId);

  const db = getDb();
  const [
    [totalCards],
    [dueCards],
    [deckCount],
    [newCards],
    [learningCards],
    [reviewCards],
    reviewedTodayList,
  ] = await Promise.all([
    db.select({ count: count() }).from(cards).where(deviceFilter),
    db
      .select({ count: count() })
      .from(cards)
      .where(and(deviceFilter, lte(cards.due, now))),
    db
      .select({ count: count() })
      .from(decks)
      .where(eq(decks.deviceId, deviceId)),
    db
      .select({ count: count() })
      .from(cards)
      .where(and(deviceFilter, eq(cards.state, 0))),
    db
      .select({ count: count() })
      .from(cards)
      .where(and(deviceFilter, inArray(cards.state, [1, 3]))),
    db
      .select({ count: count() })
      .from(cards)
      .where(and(deviceFilter, eq(cards.state, 2))),
    db
      .select({ lastReview: cards.lastReview })
      .from(cards)
      .where(and(deviceFilter, gte(cards.lastReview, todayStart.getTime()))),
  ]);

  return NextResponse.json({
    totalCards: totalCards.count,
    dueCards: dueCards.count,
    deckCount: deckCount.count,
    newCards: newCards.count,
    learningCards: learningCards.count,
    reviewCards: reviewCards.count,
    reviewedToday: reviewedTodayList.length,
  });
}
