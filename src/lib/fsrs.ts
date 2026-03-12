import { FSRS, Rating, type Card as FSRSCard, type Grade } from "ts-fsrs";
import { db, type Card } from "@/lib/db";

export { Rating };
export type { Grade };

const fsrs = new FSRS({});

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

export async function rateCard(card: Card, grade: Grade): Promise<void> {
  const now = new Date();
  const reviews = getNextReviews(card, now);
  const next = reviews[grade].card;

  await db.cards.update(card.id, {
    due: next.due.getTime(),
    stability: next.stability,
    difficulty: next.difficulty,
    reps: next.reps,
    lapses: next.lapses,
    state: next.state,
    lastReview: now.getTime(),
  });
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
