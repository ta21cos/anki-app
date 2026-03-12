"use client";

import { useState, useCallback, use } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Dexie from "dexie";
import { db } from "@/lib/db";
import {
  getNextReviews,
  rateCard,
  formatInterval,
  Rating,
  type Grade,
} from "@/lib/fsrs";
import { CardViewer } from "@/components/card-viewer";
import { RatingButtons } from "@/components/rating-buttons";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function StudyPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = use(params);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isRating, setIsRating] = useState(false);

  const deckResult = useLiveQuery(
    () => db.decks.get(deckId).then((d) => d ?? null),
    [deckId],
  );
  const deck = deckResult === undefined ? undefined : deckResult;

  const [now, setNow] = useState(() => Date.now());
  const dueCards = useLiveQuery(
    () =>
      db.cards
        .where("[deckId+due]")
        .between([deckId, Dexie.minKey], [deckId, now], true, true)
        .sortBy("due"),
    [deckId, now],
  );

  const currentCard = dueCards?.[0] ?? null;

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
        setNow(Date.now());
      } finally {
        setIsRating(false);
      }
    },
    [currentCard, isRating],
  );

  if (deckResult === undefined || dueCards === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6">
        <p className="text-muted-foreground">デッキが見つかりません</p>
        <Link href="/" className="text-primary underline">
          デッキ一覧に戻る
        </Link>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6">
        <CheckCircle2 className="size-12 text-success" />
        <h1 className="text-xl font-semibold">学習完了！</h1>
        <p className="text-center text-muted-foreground">
          「{deck.name}」の今日のカードはすべて復習しました
        </p>
        <Link href="/" className="text-primary underline">
          デッキ一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-semibold">{deck.name}</h1>
        <span className="ml-auto text-sm text-muted-foreground">
          残り {dueCards.length} 枚
        </span>
      </div>

      <CardViewer
        front={currentCard.front}
        back={currentCard.back}
        showAnswer={showAnswer}
        onShowAnswer={() => setShowAnswer(true)}
      />

      {showAnswer && intervals && (
        <RatingButtons
          intervals={intervals}
          onRate={handleRate}
          disabled={isRating}
        />
      )}
    </div>
  );
}
