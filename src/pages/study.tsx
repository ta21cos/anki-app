import { useState, useCallback } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useDeck, useDueCardsByDeck } from "@/lib/api/hooks";
import { rateCardApi } from "@/lib/api/mutations";
import {
  getNextReviews,
  computeNextCard,
  formatInterval,
  Rating,
  type Grade,
} from "@/lib/fsrs";
import { CardViewer } from "@/components/card-viewer";
import { RatingButtons } from "@/components/rating-buttons";
import { CardEditButton } from "@/components/card-edit-button";
import { ArrowLeft, CheckCircle2, Shuffle } from "lucide-react";

function shuffleArray<T>(arr: T[]): T[] {
  return arr
    .map((value) => ({ value, sortKey: Math.random() }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ value }) => value);
}

export function StudyPage() {
  const { deckId } = useParams({ from: "/study/$deckId" });
  const [showAnswer, setShowAnswer] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [shuffledCardIds, setShuffledCardIds] = useState<string[] | null>(null);

  const { data: deck, isLoading: deckLoading } = useDeck(deckId);

  const [now, setNow] = useState(() => Date.now());
  const { data: dueCards, isLoading: cardsLoading } = useDueCardsByDeck(
    deckId,
    now,
  );

  const orderedCards = (() => {
    if (!dueCards) return undefined;
    if (shuffledCardIds) {
      const cardMap = new Map(dueCards.map((c) => [c.id, c]));
      return shuffledCardIds
        .map((id) => cardMap.get(id))
        .filter((c): c is NonNullable<typeof c> => c != null);
    }
    return dueCards;
  })();

  const currentCard = orderedCards?.[0] ?? null;

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

  const handleToggleShuffle = useCallback(() => {
    if (isShuffled) {
      setShuffledCardIds(null);
      setIsShuffled(false);
    } else if (dueCards) {
      setShuffledCardIds(shuffleArray(dueCards.map((c) => c.id)));
      setIsShuffled(true);
    }
  }, [isShuffled, dueCards]);

  const handleRate = useCallback(
    async (grade: Grade) => {
      if (!currentCard || isRating) return;
      setIsRating(true);
      try {
        const fields = computeNextCard(currentCard, grade);
        await rateCardApi(currentCard.id, fields);
        setShowAnswer(false);
        setNow(Date.now());
      } finally {
        setIsRating(false);
      }
    },
    [currentCard, isRating],
  );

  if (deckLoading || cardsLoading) {
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
        <Link to="/" className="text-primary underline">
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
        <Link to="/" className="text-primary underline">
          デッキ一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-semibold">{deck.name}</h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleToggleShuffle}
            className={`rounded-md p-1.5 transition-colors ${isShuffled ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            title={isShuffled ? "期限順に戻す" : "ランダム順"}
          >
            <Shuffle className="size-4" />
          </button>
          <span className="text-sm text-muted-foreground">
            残り {orderedCards?.length ?? 0} 枚
          </span>
        </div>
      </div>

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
