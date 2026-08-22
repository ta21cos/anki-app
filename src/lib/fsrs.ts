import {
  FSRS,
  Rating,
  State,
  type Card as FSRSCard,
  type Grade,
  type RecordLogItem,
} from "ts-fsrs";
import type { Card } from "@/lib/api/hooks";

export { Rating };
export type { Grade };

const fsrs = new FSRS({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: true,
  enable_short_term: true,
});

const HARD_RETRY_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// NOTE: 当日中に同じカードを復習し直すことはないため、Good / Easy は FSRS の
// 短期学習ステップを使わず「翌日以降の 0 時」に繰り延べる。Hard は 5 分後の再挑戦とする。
export function applyDayBasedSchedule(
  fsrsResult: Record<Grade, RecordLogItem>,
  now: Date,
): Record<Grade, RecordLogItem> {
  const goodDays = Math.max(
    1,
    Math.round(fsrsResult[Rating.Good].card.scheduled_days),
  );
  const easyDays = Math.max(
    goodDays + 1,
    Math.round(fsrsResult[Rating.Easy].card.scheduled_days),
  );
  const today = startOfLocalDay(now);

  const toDayBased = (item: RecordLogItem, days: number): RecordLogItem => {
    const due = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + days,
    );
    return {
      card: { ...item.card, due, scheduled_days: days, state: State.Review },
      log: { ...item.log, scheduled_days: days },
    };
  };

  const hard = fsrsResult[Rating.Hard];

  return {
    [Rating.Again]: fsrsResult[Rating.Again],
    [Rating.Hard]: {
      card: {
        ...hard.card,
        due: new Date(now.getTime() + HARD_RETRY_MS),
        scheduled_days: 0,
      },
      log: { ...hard.log, scheduled_days: 0 },
    },
    [Rating.Good]: toDayBased(fsrsResult[Rating.Good], goodDays),
    [Rating.Easy]: toDayBased(fsrsResult[Rating.Easy], easyDays),
  };
}

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

  return applyDayBasedSchedule(
    {
      [Rating.Again]: result[Rating.Again],
      [Rating.Hard]: result[Rating.Hard],
      [Rating.Good]: result[Rating.Good],
      [Rating.Easy]: result[Rating.Easy],
    },
    now,
  );
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
    lastReview: now.getTime(),
  };
}

export function formatInterval(card: FSRSCard): string {
  const now = new Date();
  const diffMs = card.due.getTime() - now.getTime();
  if (diffMs <= 0) return "< 1分";
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "< 1分";
  if (diffMin < 60) return `${diffMin}分`;

  // NOTE: 日単位の期限はカレンダー上の日付差で表示する。時間差を丸めると
  // 夜に学習したとき「翌日 0 時」が「数時間」と表示されてしまうため。
  const calendarDays = Math.round(
    (startOfLocalDay(card.due).getTime() - startOfLocalDay(now).getTime()) /
      DAY_MS,
  );
  if (calendarDays < 1) return `${Math.round(diffMs / 3600000)}時間`;
  return `${calendarDays}日`;
}
