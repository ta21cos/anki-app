"use client";

import { mutate } from "swr";
import { apiFetch } from "./client";

export async function rateCardApi(
  cardId: string,
  fields: {
    due: number;
    stability: number;
    difficulty: number;
    reps: number;
    lapses: number;
    state: number;
    last_review: number;
  },
) {
  await apiFetch(`/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
  await mutate(
    (key) =>
      typeof key === "string" &&
      (key.includes("/cards") || key.includes("/stats")),
  );
}

export async function updateCard(
  cardId: string,
  fields: Record<string, unknown>,
) {
  await apiFetch(`/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
  await mutate((key) => typeof key === "string" && key.includes("/cards"));
}

export async function addCard(
  deckId: string,
  card: {
    id: string;
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
  },
) {
  await apiFetch(`/decks/${deckId}/cards`, {
    method: "POST",
    body: JSON.stringify(card),
  });
  await mutate(
    (key) => typeof key === "string" && key.includes(`/decks/${deckId}`),
  );
}

export async function deleteCard(cardId: string) {
  await apiFetch(`/cards/${cardId}`, { method: "DELETE" });
  await mutate((key) => typeof key === "string" && key.includes("/cards"));
}

export async function updateDeckName(deckId: string, name: string) {
  await apiFetch(`/decks/${deckId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  await mutate((key) => typeof key === "string" && key.includes("/decks"));
}

export async function importDeck(
  deck: { id: string; name: string; createdAt: number },
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
  }>,
) {
  await apiFetch("/decks", {
    method: "POST",
    body: JSON.stringify({ deck, cards }),
  });
  await mutate((key) => typeof key === "string" && key.includes("/decks"));
}

export async function deleteDeck(deckId: string) {
  await apiFetch(`/decks/${deckId}`, { method: "DELETE" });
  await mutate(
    (key) =>
      typeof key === "string" &&
      (key.includes("/decks") || key.includes("/cards")),
  );
}

export async function mergeDecks(
  targetDeckId: string,
  sourceDeckIds: string[],
) {
  await apiFetch("/decks/merge", {
    method: "POST",
    body: JSON.stringify({ targetDeckId, sourceDeckIds }),
  });
  await mutate(
    (key) =>
      typeof key === "string" &&
      (key.includes("/decks") || key.includes("/cards")),
  );
}
