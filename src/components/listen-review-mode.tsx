"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Card } from "@/lib/api/hooks";
import {
  getNextReviews,
  computeNextCard,
  formatInterval,
  Rating,
  type Grade,
} from "@/lib/fsrs";
import { rateCardApi } from "@/lib/api/mutations";
import { stripHtmlToPlainText, speak, stopSpeaking } from "@/lib/tts";
import { CardViewer } from "@/components/card-viewer";
import { RatingButtons } from "@/components/rating-buttons";
import { CardEditButton } from "@/components/card-edit-button";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SPEED_OPTIONS = [
  { label: "0.7x", rate: 0.7 },
  { label: "0.85x", rate: 0.85 },
  { label: "1x", rate: 1.0 },
  { label: "1.2x", rate: 1.2 },
  { label: "1.5x", rate: 1.5 },
];

interface ListenReviewModeProps {
  cards: Card[];
  deckNameMap?: Record<string, string>;
  onComplete: (reviewedCount: number) => void;
}

export function ListenReviewMode({
  cards,
  deckNameMap,
  onComplete,
}: ListenReviewModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(2);
  const [reviewedCount, setReviewedCount] = useState(0);

  const speedRef = useRef(speedIndex);
  useEffect(() => {
    speedRef.current = speedIndex;
  }, [speedIndex]);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const currentCard = cards[currentIndex] ?? null;

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

  const handlePlay = useCallback(() => {
    if (!currentCard) return;

    if (isPlaying) {
      stopSpeaking();
      setIsPlaying(false);
      return;
    }

    const text = stripHtmlToPlainText(currentCard.back);
    if (!text) {
      setHasPlayed(true);
      return;
    }

    setIsPlaying(true);
    speak(text, {
      rate: SPEED_OPTIONS[speedRef.current].rate,
      onEnd: () => {
        setIsPlaying(false);
        setHasPlayed(true);
      },
    });
  }, [currentCard, isPlaying]);

  const handleRate = useCallback(
    async (grade: Grade) => {
      if (!currentCard || isRating) return;
      setIsRating(true);
      try {
        const fields = computeNextCard(currentCard, grade);
        await rateCardApi(currentCard.id, fields);
        stopSpeaking();
        const newCount = reviewedCount + 1;
        setReviewedCount(newCount);

        const nextIndex = currentIndex + 1;
        if (nextIndex >= cards.length) {
          onComplete(newCount);
        } else {
          setCurrentIndex(nextIndex);
          setHasPlayed(false);
          setIsPlaying(false);
        }
      } finally {
        setIsRating(false);
      }
    },
    [
      currentCard,
      isRating,
      currentIndex,
      cards.length,
      reviewedCount,
      onComplete,
    ],
  );

  if (!currentCard) return null;

  const canRate = isPlaying || hasPlayed;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {currentIndex + 1} / {cards.length}
        </span>
        <span className="text-sm text-muted-foreground">
          復習済み {reviewedCount} 枚
        </span>
      </div>

      {deckNameMap?.[currentCard.deckId] && (
        <div className="mb-2">
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            {deckNameMap[currentCard.deckId]}
          </span>
        </div>
      )}

      <CardViewer
        front={currentCard.front}
        back={currentCard.back}
        showAnswer={true}
        onShowAnswer={() => {}}
      />

      <div className="mt-3 flex justify-end">
        <CardEditButton
          cardId={currentCard.id}
          front={currentCard.front}
          back={currentCard.back}
        />
      </div>

      <div className="mt-4 space-y-4">
        <div className="flex items-center justify-center gap-4">
          <Button size="icon-lg" onClick={handlePlay} className="rounded-full">
            {isPlaying ? (
              <Pause className="size-5" />
            ) : (
              <Play className="size-5 ml-0.5" />
            )}
          </Button>
        </div>

        <div className="flex items-center justify-center gap-1">
          {SPEED_OPTIONS.map((opt, i) => (
            <button
              key={opt.label}
              onClick={() => setSpeedIndex(i)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                i === speedIndex
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {intervals && (
          <div className={cn(!canRate && "pointer-events-none opacity-40")}>
            <RatingButtons
              intervals={intervals}
              onRate={handleRate}
              disabled={isRating || !canRate}
            />
          </div>
        )}

        {!canRate && (
          <p className="text-center text-xs text-muted-foreground">
            再生ボタン��押すと評価できます
          </p>
        )}
      </div>
    </div>
  );
}
