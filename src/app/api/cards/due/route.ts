import { NextResponse } from "next/server";
import { and, asc, eq, lte } from "drizzle-orm";
import { getDb } from "@/lib/server/db";
import { cards } from "@/lib/server/schema";
import { getDeviceId } from "@/lib/server/auth";

export async function GET(request: Request) {
  const db = getDb();
  const deviceId = getDeviceId(request);
  const url = new URL(request.url);
  const before = url.searchParams.get("before") ?? String(Date.now());

  const result = await db
    .select()
    .from(cards)
    .where(and(eq(cards.deviceId, deviceId), lte(cards.due, Number(before))))
    .orderBy(asc(cards.due));

  return NextResponse.json(result);
}
