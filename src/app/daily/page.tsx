"use client";

import { useState, useCallback } from "react";
import { useDecks, useDueCards } from "@/lib/api/hooks";
import { rateCardApi } from "@/lib/api/mutations";
import {
  getNextReviews,
  computeNextCard,
  formatInterval,
  Rating,
  type Grade,
} from "@/lib/fsrs";
import { CardViewer } from "@/components/card-viewer";
import { CardEditButton } from "@/components/card-edit-button";
import { RatingButtons } from "@/components/rating-buttons";
import { ListenReviewMode } from "@/components/listen-review-mode";
import {
  CheckCircle2,
  Minus,
  Plus,
  CreditCard,
  Volume2,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_DAILY_LIMIT = 20;
const MIN_LIMIT = 5;
const MAX_LIMIT = 100;
const STEP = 5;

type Mode = "start" | "card" | "audio";

export default function DailyPage() {
  const [mode, setMode] = useState<Mode>("start");
  const [selectedMode, setSelectedMode] = useState<"card" | "audio">("card");
  const [dailyLimit, setDailyLimit] = useState(DEFAULT_DAILY_LIMIT);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [completedCount, setCompletedCount] = useState<number | null>(null);

  const [now, setNow] = useState(() => Date.now());

  const { data: rawDueCards } = useDueCards(now);
  const { data: decks } = useDecks();

  const dueCards = rawDueCards
    ? [...rawDueCards].sort((a, b) => {
        if (a.state === 0 && b.state !== 0) return -1;
        if (a.state !== 0 && b.state === 0) return 1;
        return a.due - b.due;
      })
    : undefined;

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
        const fields = computeNextCard(currentCard, grade);
        await rateCardApi(currentCard.id, fields);
        setShowAnswer(false);
        setReviewedCount((c) => c + 1);
        setNow(Date.now());
      } finally {
        setIsRating(false);
      }
    },
    [currentCard, isRating],
  );

  const handleStart = useCallback(() => {
    setMode(selectedMode);
    setReviewedCount(0);
    setCompletedCount(null);
    setNow(Date.now());
  }, [selectedMode]);

  const handleAudioComplete = useCallback((count: number) => {
    setCompletedCount(count);
    setMode("start");
  }, []);

  const handleBackToStart = useCallback(() => {
    setMode("start");
    setReviewedCount(0);
    setNow(Date.now());
  }, []);

  if (dueCards === undefined || decks === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  if (mode === "start") {
    return (
      <div className="px-4 pt-6">
        <h1 className="mb-6 text-lg font-semibold">今日の学習</h1>

        {completedCount !== null && completedCount > 0 && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
            <CheckCircle2 className="size-5 text-green-600 dark:text-green-400" />
            <span className="text-sm text-green-700 dark:text-green-300">
              {completedCount} 枚のカードを復習しました
            </span>
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              学習枚数
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  setDailyLimit((l) => Math.max(MIN_LIMIT, l - STEP))
                }
                disabled={dailyLimit <= MIN_LIMIT}
                className="rounded-md border p-2 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
              >
                <Minus className="size-4" />
              </button>
              <span className="min-w-[3rem] text-center text-lg font-semibold">
                {dailyLimit}
              </span>
              <button
                onClick={() =>
                  setDailyLimit((l) => Math.min(MAX_LIMIT, l + STEP))
                }
                disabled={dailyLimit >= MAX_LIMIT}
                className="rounded-md border p-2 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
              >
                <Plus className="size-4" />
              </button>
              <span className="text-sm text-muted-foreground">
                / {totalDue} 枚
              </span>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              学習モード
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedMode("card")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors",
                  selectedMode === "card"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30",
                )}
              >
                <CreditCard
                  className={cn(
                    "size-6",
                    selectedMode === "card"
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    selectedMode === "card"
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  カード
                </span>
              </button>
              <button
                onClick={() => setSelectedMode("audio")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors",
                  selectedMode === "audio"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30",
                )}
              >
                <Volume2
                  className={cn(
                    "size-6",
                    selectedMode === "audio"
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    selectedMode === "audio"
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  音声
                </span>
              </button>
            </div>
          </div>

          <Button
            onClick={handleStart}
            disabled={totalDue === 0}
            className="w-full gap-2"
            size="lg"
          >
            <Play className="size-4" />
            学習を始める
          </Button>

          {totalDue === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              復習するカードがありません
            </p>
          )}
        </div>
      </div>
    );
  }

  if (mode === "audio") {
    return (
      <div className="px-4 pt-6">
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={handleBackToStart}
            className="text-muted-foreground hover:text-foreground"
          >
            ← 戻る
          </button>
          <h1 className="text-lg font-semibold">今日の学習（音声）</h1>
        </div>

        <ListenReviewMode
          cards={limitedCards}
          deckNameMap={deckNameMap}
          onComplete={handleAudioComplete}
        />
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6">
        <CheckCircle2 className="size-12 text-success" />
        <h1 className="text-xl font-semibold">
          {reviewedCount > 0
            ? "今日の学習完了！"
            : "復習するカードがありません"}
        </h1>
        {reviewedCount > 0 && (
          <p className="text-center text-muted-foreground">
            {reviewedCount} 枚のカードを復習しました
          </p>
        )}
        <button onClick={handleBackToStart} className="text-primary underline">
          スタートに戻る
        </button>
      </div>
    );
  }

  const remaining = limitedCards.length;

  return (
    <div className="px-4 pt-6">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackToStart}
              className="text-muted-foreground hover:text-foreground"
            >
              ← 戻る
            </button>
            <h1 className="text-lg font-semibold">今日の学習</h1>
          </div>
          <span className="text-sm text-muted-foreground">
            残り {remaining} 枚
            {totalDue > dailyLimit && (
              <span className="ml-1 text-xs">(全{totalDue}枚中)</span>
            )}
          </span>
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
