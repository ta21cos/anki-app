import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { cloudflareAccess } from "@hono/cloudflare-access";
import { and, asc, count, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb, type Env } from "./db";
import { cards, decks } from "./schema";

type Variables = { ownerId: string };

const app = new Hono<{ Bindings: Env; Variables: Variables }>().basePath(
  "/api",
);

// DEV_OWNER_ID branch: local dev / e2e only (never set in production).
// X-Dev-Owner header override keeps e2e tests isolated per test, matching
// the per-context random device token behavior the tests were built on.
app.use("*", async (c, next) => {
  if (c.env.DEV_OWNER_ID) {
    c.set("ownerId", c.req.header("X-Dev-Owner") ?? c.env.DEV_OWNER_ID);
    return next();
  }
  if (!c.env.CF_ACCESS_TEAM) {
    throw new HTTPException(500, { message: "CF_ACCESS_TEAM is not set" });
  }
  // aud 照合: 同じ team の別アプリケーション向けに発行された JWT を弾く。
  // aud が未設定なら middleware は team 名のみで検証する（後方互換）。
  const expectedAud = [c.env.CF_ACCESS_AUD, c.env.CF_ACCESS_AUD_PREVIEW].filter(
    (aud): aud is string => Boolean(aud),
  );
  const verifyAccessJwt =
    expectedAud.length > 0
      ? cloudflareAccess(c.env.CF_ACCESS_TEAM, expectedAud)
      : cloudflareAccess(c.env.CF_ACCESS_TEAM);
  return verifyAccessJwt(c, async () => {
    const email = c.get("accessPayload").email;
    if (!email) {
      throw new HTTPException(403, {
        message: "Access token has no email claim",
      });
    }
    c.set("ownerId", email);
    await next();
  });
});

const CARD_FIELDS = [
  "front",
  "back",
  "due",
  "stability",
  "difficulty",
  "reps",
  "lapses",
  "state",
  "lastReview",
] as const;

type CardPatch = Partial<
  Pick<typeof cards.$inferInsert, (typeof CARD_FIELDS)[number]>
>;

function pickCardFields(body: Record<string, unknown>): CardPatch {
  return Object.fromEntries(
    CARD_FIELDS.filter((key) => key in body).map((key) => [key, body[key]]),
  ) as CardPatch;
}

app.get("/decks", async (c) => {
  const db = getDb(c.env);
  const result = await db
    .select()
    .from(decks)
    .where(eq(decks.ownerId, c.get("ownerId")));
  return c.json(result);
});

app.post("/decks", async (c) => {
  const db = getDb(c.env);
  const ownerId = c.get("ownerId");
  const { deck, cards: cardList } = (await c.req.json()) as {
    deck: { id: string; name: string; createdAt: number };
    cards: Array<Omit<typeof cards.$inferInsert, "ownerId">>;
  };

  await db.insert(decks).values({
    id: deck.id,
    ownerId,
    name: deck.name,
    createdAt: deck.createdAt,
  });

  if (cardList.length > 0) {
    await db
      .insert(cards)
      .values(cardList.map((card) => ({ ...card, ownerId })));
  }

  return c.json({ id: deck.id }, 201);
});

app.post("/decks/merge", async (c) => {
  const db = getDb(c.env);
  const ownerId = c.get("ownerId");
  const { targetDeckId, sourceDeckIds } = (await c.req.json()) as {
    targetDeckId: string;
    sourceDeckIds: string[];
  };

  const toMerge = sourceDeckIds.filter((id) => id !== targetDeckId);
  if (toMerge.length === 0) {
    return c.json({ movedCount: 0 });
  }

  await db
    .update(cards)
    .set({ deckId: targetDeckId })
    .where(and(eq(cards.ownerId, ownerId), inArray(cards.deckId, toMerge)));

  await db
    .delete(decks)
    .where(and(eq(decks.ownerId, ownerId), inArray(decks.id, toMerge)));

  return c.json({ ok: true });
});

app.get("/decks/:deckId", async (c) => {
  const db = getDb(c.env);
  const deckId = c.req.param("deckId");
  const [deck] = await db
    .select()
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.ownerId, c.get("ownerId"))));
  if (!deck) return c.json(null, 404);
  return c.json(deck);
});

app.patch("/decks/:deckId", async (c) => {
  const db = getDb(c.env);
  const deckId = c.req.param("deckId");
  const body = (await c.req.json()) as {
    name?: string;
    includeInDaily?: boolean;
  };

  const patch: Partial<{ name: string; includeInDaily: boolean }> = {
    ...(typeof body.name === "string" ? { name: body.name } : {}),
    ...(typeof body.includeInDaily === "boolean"
      ? { includeInDaily: body.includeInDaily }
      : {}),
  };

  if (Object.keys(patch).length > 0) {
    await db
      .update(decks)
      .set(patch)
      .where(and(eq(decks.id, deckId), eq(decks.ownerId, c.get("ownerId"))));
  }
  return c.json({ ok: true });
});

app.delete("/decks/:deckId", async (c) => {
  const db = getDb(c.env);
  const ownerId = c.get("ownerId");
  const deckId = c.req.param("deckId");
  await db
    .delete(cards)
    .where(and(eq(cards.deckId, deckId), eq(cards.ownerId, ownerId)));
  await db
    .delete(decks)
    .where(and(eq(decks.id, deckId), eq(decks.ownerId, ownerId)));
  return c.json({ ok: true });
});

app.get("/decks/:deckId/cards", async (c) => {
  const db = getDb(c.env);
  const deckId = c.req.param("deckId");
  const dueBefore = c.req.query("due_before");

  const conditions = [
    eq(cards.ownerId, c.get("ownerId")),
    eq(cards.deckId, deckId),
  ];
  if (dueBefore) {
    conditions.push(lte(cards.due, Number(dueBefore)));
  }

  const result = await db
    .select()
    .from(cards)
    .where(and(...conditions))
    .orderBy(asc(cards.due));

  return c.json(result);
});

app.post("/decks/:deckId/cards", async (c) => {
  const db = getDb(c.env);
  const deckId = c.req.param("deckId");
  const body = (await c.req.json()) as Record<string, unknown> & {
    id?: string;
    createdAt: number;
  };

  const card = {
    ...pickCardFields(body),
    id: body.id ?? crypto.randomUUID(),
    ownerId: c.get("ownerId"),
    deckId,
    createdAt: body.createdAt,
  } as typeof cards.$inferInsert;

  await db.insert(cards).values(card);
  return c.json(card, 201);
});

app.get("/decks/:deckId/cards/count", async (c) => {
  const db = getDb(c.env);
  const deckId = c.req.param("deckId");
  const dueBefore = c.req.query("due_before");

  const conditions = [
    eq(cards.ownerId, c.get("ownerId")),
    eq(cards.deckId, deckId),
  ];
  if (dueBefore) {
    conditions.push(lte(cards.due, Number(dueBefore)));
  }

  const [result] = await db
    .select({ count: count() })
    .from(cards)
    .where(and(...conditions));

  return c.json({ count: result.count });
});

app.get("/cards/due", async (c) => {
  const db = getDb(c.env);
  const before = c.req.query("before") ?? String(Date.now());

  const result = await db
    .select()
    .from(cards)
    .where(
      and(eq(cards.ownerId, c.get("ownerId")), lte(cards.due, Number(before))),
    )
    .orderBy(asc(cards.due));

  return c.json(result);
});

app.patch("/cards/:cardId", async (c) => {
  const db = getDb(c.env);
  const cardId = c.req.param("cardId");
  const body = (await c.req.json()) as Record<string, unknown>;
  const patch = pickCardFields(body);

  if (Object.keys(patch).length > 0) {
    await db
      .update(cards)
      .set(patch)
      .where(and(eq(cards.id, cardId), eq(cards.ownerId, c.get("ownerId"))));
  }

  return c.json({ ok: true });
});

app.delete("/cards/:cardId", async (c) => {
  const db = getDb(c.env);
  const cardId = c.req.param("cardId");
  await db
    .delete(cards)
    .where(and(eq(cards.id, cardId), eq(cards.ownerId, c.get("ownerId"))));
  return c.json({ ok: true });
});

app.get("/stats", async (c) => {
  const db = getDb(c.env);
  const ownerId = c.get("ownerId");
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const ownerFilter = eq(cards.ownerId, ownerId);

  const [
    [totalCards],
    [dueCards],
    [deckCount],
    [newCards],
    [learningCards],
    [reviewCards],
    reviewedTodayList,
  ] = await Promise.all([
    db.select({ count: count() }).from(cards).where(ownerFilter),
    db
      .select({ count: count() })
      .from(cards)
      .where(and(ownerFilter, lte(cards.due, now))),
    db.select({ count: count() }).from(decks).where(eq(decks.ownerId, ownerId)),
    db
      .select({ count: count() })
      .from(cards)
      .where(and(ownerFilter, eq(cards.state, 0))),
    db
      .select({ count: count() })
      .from(cards)
      .where(and(ownerFilter, inArray(cards.state, [1, 3]))),
    db
      .select({ count: count() })
      .from(cards)
      .where(and(ownerFilter, eq(cards.state, 2))),
    db
      .select({ lastReview: cards.lastReview })
      .from(cards)
      .where(and(ownerFilter, gte(cards.lastReview, todayStart.getTime()))),
  ]);

  return c.json({
    totalCards: totalCards.count,
    dueCards: dueCards.count,
    deckCount: deckCount.count,
    newCards: newCards.count,
    learningCards: learningCards.count,
    reviewCards: reviewCards.count,
    reviewedToday: reviewedTodayList.length,
  });
});

export default app;
