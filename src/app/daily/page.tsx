"use client";

import { useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import {
  getNextReviews,
  rateCard,
  formatInterval,
  Rating,
  type Grade,
} from "@/lib/fsrs";
import { CardViewer } from "@/components/card-viewer";
import { CardEditButton } from "@/components/card-edit-button";
import { RatingButtons } from "@/components/rating-buttons";
import { CheckCircle2, Minus, Plus } from "lucide-react";

const DEFAULT_DAILY_LIMIT = 20;
const MIN_LIMIT = 5;
const MAX_LIMIT = 100;
const STEP = 5;

export default function DailyPage() {
  const [showAnswer, setShowAnswer] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(DEFAULT_DAILY_LIMIT);
  const [reviewedCount, setReviewedCount] = useState(0);

  const [now, setNow] = useState(() => Date.now());

  const dueCards = useLiveQuery(
    () =>
      db.cards
        .where("due")
        .belowOrEqual(now)
        .sortBy("due"),
    [now],
  );

  const decks = useLiveQuery(() => db.decks.toArray());

  const deckNameMap = decks
    ? Object.fromEntries(decks.map((d) => [d.id, d.name]))
    : {};

  const limitedCards = dueCards?.slice(0, dailyLimit) ?? [];
  const currentCard = limitedCards[0] ?? null;
  const totalDue = dueCards?.length ?? 0;

  const intervals = currentCard
    ? (() => {
        const reviews = getNextReviews(currentCard);
        return {
          [Rating.Again]: formatInterval(reviews[Rating.Again].card),
          [Rating.Hard]: formatInterval(reviews[Rating.Hard].card),
          [Rating.Good]: formatInterval(reviews[Rating.Good].card),
          [Rating.Easy]: formatInterval(reviews[Rating.Easy].card),
        } as Record<Grade, string>;
      })()
    : null;

  const handleRate = useCallback(
    async (grade: Grade) => {
      if (!currentCard || isRating) return;
      setIsRating(true);
      try {
        await rateCard(currentCard, grade);
        setShowAnswer(false);
        setReviewedCount((c) => c + 1);
        setNow(Date.now());
      } finally {
        setIsRating(false);
      }
    },
    [currentCard, isRating],
  );

  if (dueCards === undefined || decks === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6">
        <CheckCircle2 className="size-12 text-success" />
        <h1 className="text-xl font-semibold">
          {reviewedCount > 0 ? "今日の学習完了！" : "復習するカードがありません"}
        </h1>
        {reviewedCount > 0 && (
          <p className="text-center text-muted-foreground">
            {reviewedCount} 枚のカードを復習しました
          </p>
        )}
        {reviewedCount === 0 && (
          <p className="text-center text-muted-foreground">
            すべてのカードが復習済みです
          </p>
        )}
      </div>
    );
  }

  const remaining = limitedCards.length;

  return (
    <div className="px-4 pt-6">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">今日の学習</h1>
          <span className="text-sm text-muted-foreground">
            残り {remaining} 枚
            {totalDue > dailyLimit && (
              <span className="ml-1 text-xs">(全{totalDue}枚中)</span>
            )}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">1日の枚数:</span>
          <button
            onClick={() => setDailyLimit((l) => Math.max(MIN_LIMIT, l - STEP))}
            disabled={dailyLimit <= MIN_LIMIT}
            className="rounded-md border p-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="min-w-[2.5rem] text-center text-sm font-medium">
            {dailyLimit}
          </span>
          <button
            onClick={() => setDailyLimit((l) => Math.min(MAX_LIMIT, l + STEP))}
            disabled={dailyLimit >= MAX_LIMIT}
            className="rounded-md border p-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>

      {deckNameMap[currentCard.deckId] && (
        <div className="mb-2">
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            {deckNameMap[currentCard.deckId]}
          </span>
        </div>
      )}

      <CardViewer
        front={currentCard.front}
        back={currentCard.back}
        showAnswer={showAnswer}
        onShowAnswer={() => setShowAnswer(true)}
      />

      {showAnswer && (
        <>
          <div className="mt-3 flex justify-end">
            <CardEditButton
              cardId={currentCard.id}
              front={currentCard.front}
              back={currentCard.back}
            />
          </div>
          {intervals && (
            <RatingButtons
              intervals={intervals}
              onRate={handleRate}
              disabled={isRating}
            />
          )}
        </>
      )}
    </div>
  );
}
