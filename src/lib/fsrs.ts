import { FSRS, Rating, type Card as FSRSCard, type Grade } from "ts-fsrs";
import type { Card } from "@/lib/api/hooks";

export { Rating };
export type { Grade };

const fsrs = new FSRS({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: true,
  enable_short_term: true,
});

export function getNextReviews(card: Card, now: Date = new Date()) {
  const fsrsCard: FSRSCard = {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.lastReview ? new Date(card.lastReview) : undefined,
  };

  const result = fsrs.repeat(fsrsCard, now);

  return {
    [Rating.Again]: {
      card: result[Rating.Again].card,
      log: result[Rating.Again].log,
    },
    [Rating.Hard]: {
      card: result[Rating.Hard].card,
      log: result[Rating.Hard].log,
    },
    [Rating.Good]: {
      card: result[Rating.Good].card,
      log: result[Rating.Good].log,
    },
    [Rating.Easy]: {
      card: result[Rating.Easy].card,
      log: result[Rating.Easy].log,
    },
  };
}

export function computeNextCard(card: Card, grade: Grade) {
  const now = new Date();
  const reviews = getNextReviews(card, now);
  const next = reviews[grade].card;

  return {
    due: next.due.getTime(),
    stability: next.stability,
    difficulty: next.difficulty,
    reps: next.reps,
    lapses: next.lapses,
    state: next.state,
    last_review: now.getTime(),
  };
}

export function formatInterval(card: FSRSCard): string {
  const now = new Date();
  const dueDate = card.due;
  const diffMs = dueDate.getTime() - now.getTime();
  if (diffMs <= 0) return "< 1分";
  const diffMin = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMin < 1) return "< 1分";
  if (diffMin < 60) return `${diffMin}分`;
  if (diffHours < 24) return `${diffHours}時間`;
  return `${diffDays}日`;
}
