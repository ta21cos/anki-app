"use client";

import useSWR from "swr";
import { apiFetch } from "./client";

export type Deck = {
  id: string;
  name: string;
  createdAt: number;
};

export type Card = {
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
};

export type Stats = {
  totalCards: number;
  dueCards: number;
  deckCount: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  reviewedToday: number;
};

type ApiDeck = {
  id: string;
  device_id: string;
  name: string;
  created_at: number;
};

type ApiCard = {
  id: string;
  device_id: string;
  deck_id: string;
  front: string;
  back: string;
  due: number;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: number | null;
  created_at: number;
};

function toDeck(d: ApiDeck): Deck {
  return { id: d.id, name: d.name, createdAt: d.created_at };
}

function toCard(c: ApiCard): Card {
  return {
    id: c.id,
    deckId: c.deck_id,
    front: c.front,
    back: c.back,
    due: c.due,
    stability: c.stability,
    difficulty: c.difficulty,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    lastReview: c.last_review,
    createdAt: c.created_at,
  };
}

async function fetchDecks(path: string): Promise<Deck[]> {
  const data = await apiFetch<ApiDeck[]>(path);
  return data.map(toDeck);
}

async function fetchDeck(path: string): Promise<Deck | null> {
  const data = await apiFetch<ApiDeck | null>(path);
  return data ? toDeck(data) : null;
}

async function fetchCards(path: string): Promise<Card[]> {
  const data = await apiFetch<ApiCard[]>(path);
  return data.map(toCard);
}

async function fetchCount(path: string): Promise<{ count: number }> {
  return apiFetch<{ count: number }>(path);
}

async function fetchStats(path: string): Promise<Stats> {
  return apiFetch<Stats>(path);
}

export function useDecks() {
  return useSWR("/decks", fetchDecks);
}

export function useDeck(deckId: string | undefined) {
  return useSWR(deckId ? `/decks/${deckId}` : null, fetchDeck);
}

export function useDeckCards(deckId: string | undefined) {
  return useSWR(deckId ? `/decks/${deckId}/cards` : null, fetchCards);
}

export function useDeckCardCount(deckId: string | undefined) {
  return useSWR(deckId ? `/decks/${deckId}/cards/count` : null, fetchCount);
}

export function useDeckDueCount(deckId: string | undefined, now: number) {
  return useSWR(
    deckId ? `/decks/${deckId}/cards/count?due_before=${now}` : null,
    fetchCount,
  );
}

export function useDueCards(now: number) {
  return useSWR(`/cards/due?before=${now}`, fetchCards);
}

export function useDueCardsByDeck(deckId: string | undefined, now: number) {
  return useSWR(
    deckId ? `/decks/${deckId}/cards?due_before=${now}` : null,
    fetchCards,
  );
}

export function useStats() {
  return useSWR("/stats", fetchStats);
}
