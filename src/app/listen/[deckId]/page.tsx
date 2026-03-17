"use client";

import { useState, useCallback, useEffect, useRef, use } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Card } from "@/lib/db";
import { stripHtmlToPlainText, speak, stopSpeaking } from "@/lib/tts";
import { CardViewer } from "@/components/card-viewer";
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Volume2,
  Minus,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function ListenPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = use(params);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [delay, setDelay] = useState(2);

  const autoModeRef = useRef(autoMode);
  const delayRef = useRef(delay);
  const currentIndexRef = useRef(currentIndex);
  const cardsRef = useRef<Card[] | null>(null);

  useEffect(() => {
    autoModeRef.current = autoMode;
  }, [autoMode]);
  useEffect(() => {
    delayRef.current = delay;
  }, [delay]);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const deck = useLiveQuery(
    () => db.decks.get(deckId).then((d) => d ?? null),
    [deckId],
  );

  const cards = useLiveQuery(
    () => db.cards.where("deckId").equals(deckId).toArray(),
    [deckId],
  );

  useEffect(() => {
    cardsRef.current = cards ?? null;
  }, [cards]);

  const currentCard = cards?.[currentIndex] ?? null;
  const totalCards = cards?.length ?? 0;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const speakAtIndexRef = useRef<(index: number) => void>(() => {});

  const speakAtIndex = useCallback((index: number) => {
    const currentCards = cardsRef.current;
    if (!currentCards || !currentCards[index]) return;

    const text = stripHtmlToPlainText(currentCards[index].back);
    if (!text) {
      if (autoModeRef.current && index < currentCards.length - 1) {
        timerRef.current = setTimeout(() => {
          const nextIndex = index + 1;
          currentIndexRef.current = nextIndex;
          setCurrentIndex(nextIndex);
          speakAtIndexRef.current(nextIndex);
        }, delayRef.current * 1000);
      } else {
        setIsPlaying(false);
      }
      return;
    }

    setIsPlaying(true);
    speak(text, {
      onEnd: () => {
        if (
          autoModeRef.current &&
          currentIndexRef.current < currentCards.length - 1
        ) {
          timerRef.current = setTimeout(() => {
            const nextIndex = currentIndexRef.current + 1;
            currentIndexRef.current = nextIndex;
            setCurrentIndex(nextIndex);
            speakAtIndexRef.current(nextIndex);
          }, delayRef.current * 1000);
        } else {
          setIsPlaying(false);
        }
      },
    });
  }, []);

  useEffect(() => {
    speakAtIndexRef.current = speakAtIndex;
  }, [speakAtIndex]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      clearTimer();
    };
  }, [clearTimer]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      stopSpeaking();
      clearTimer();
      setIsPlaying(false);
    } else {
      speakAtIndex(currentIndexRef.current);
    }
  }, [isPlaying, speakAtIndex, clearTimer]);

  const handleNext = useCallback(() => {
    stopSpeaking();
    clearTimer();
    const currentCards = cardsRef.current;
    if (!currentCards) return;
    const nextIndex = Math.min(
      currentIndexRef.current + 1,
      currentCards.length - 1,
    );
    currentIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);
    if (autoMode) {
      speakAtIndex(nextIndex);
    } else {
      setIsPlaying(false);
    }
  }, [clearTimer, autoMode, speakAtIndex]);

  const handlePrev = useCallback(() => {
    stopSpeaking();
    clearTimer();
    const prevIndex = Math.max(0, currentIndexRef.current - 1);
    currentIndexRef.current = prevIndex;
    setCurrentIndex(prevIndex);
    if (autoMode) {
      speakAtIndex(prevIndex);
    } else {
      setIsPlaying(false);
    }
  }, [clearTimer, autoMode, speakAtIndex]);

  const handleAutoModeToggle = useCallback(() => {
    setAutoMode((prev) => !prev);
  }, []);

  if (deck === undefined || cards === undefined) {
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

  if (totalCards === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6">
        <Volume2 className="size-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">カードがありません</h1>
        <p className="text-center text-muted-foreground">
          このデッキにはまだカードがありません
        </p>
        <Link href="/" className="text-primary underline">
          デッキ一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-32">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Volume2 className="size-5 text-primary" />
          <h1 className="text-lg font-semibold">{deck.name}</h1>
        </div>
        <span className="ml-auto text-sm text-muted-foreground">
          {currentIndex + 1} / {totalCards}
        </span>
      </div>

      {currentCard && (
        <CardViewer
          front={currentCard.front}
          back={currentCard.back}
          showAnswer={true}
          onShowAnswer={() => {}}
        />
      )}

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrev}
            disabled={currentIndex === 0}
          >
            <SkipBack className="size-5" />
          </Button>

          <Button
            size="icon-lg"
            onClick={handlePlayPause}
            className="rounded-full"
          >
            {isPlaying ? (
              <Pause className="size-5" />
            ) : (
              <Play className="size-5 ml-0.5" />
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            disabled={currentIndex >= totalCards - 1}
          >
            <SkipForward className="size-5" />
          </Button>
        </div>

        <div className="flex flex-col items-center gap-3 rounded-lg border p-4">
          <button
            onClick={handleAutoModeToggle}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              autoMode
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            <Repeat className="size-4" />
            自動モード
          </button>

          {autoMode && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">間隔</span>
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() => setDelay((d) => Math.max(0.5, d - 0.5))}
                disabled={delay <= 0.5}
              >
                <Minus className="size-3" />
              </Button>
              <span className="w-12 text-center text-sm font-medium">
                {delay}秒
              </span>
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() => setDelay((d) => Math.min(10, d + 0.5))}
                disabled={delay >= 10}
              >
                <Plus className="size-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
