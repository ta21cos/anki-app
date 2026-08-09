import useSWR from "swr";
import { apiFetch } from "./client";

export type Deck = {
  id: string;
  name: string;
  includeInDaily: boolean;
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

function fetchDecks(path: string): Promise<Deck[]> {
  return apiFetch<Deck[]>(path);
}

function fetchDeck(path: string): Promise<Deck | null> {
  return apiFetch<Deck | null>(path);
}

function fetchCards(path: string): Promise<Card[]> {
  return apiFetch<Card[]>(path);
}

function fetchCount(path: string): Promise<{ count: number }> {
  return apiFetch<{ count: number }>(path);
}

function fetchStats(path: string): Promise<Stats> {
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
  return useSWR(`/stats`, fetchStats);
}
