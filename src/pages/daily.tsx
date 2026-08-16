import { useState, useCallback } from "react";
import { useDecks, useDueCards, type Deck } from "@/lib/api/hooks";
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
import { AudioQuizPlayer } from "@/components/audio-quiz-player";
import {
  prepareAudioQuiz,
  AUDIO_QUIZ_MAX_CARDS,
  type AudioSession,
} from "@/lib/api/audio";
import {
  CheckCircle2,
  Headphones,
  Minus,
  Plus,
  CreditCard,
  Volume2,
  Play,
  ArrowDownNarrowWide,
  Shuffle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_DAILY_LIMIT = 20;
const MIN_LIMIT = 5;
const MAX_LIMIT = 100;
const STEP = 5;
// NOTE: 想起ポーズの秒数。単語なら短く、文章の英作文なら長めが要るので
// 開始画面で選べるようにする。
const AUDIO_QUIZ_PAUSE_OPTIONS = [3, 6, 10] as const;
const DEFAULT_AUDIO_QUIZ_PAUSE_SECONDS = 6;

type Mode = "start" | "card" | "audio" | "audioquiz";
type Order = "default" | "random";

type AudioQuizState =
  | { status: "preparing"; done: number; total: number }
  | { status: "ready"; session: AudioSession }
  | { status: "error"; message: string };

type SessionResult = {
  cardId: string;
  front: string;
  deckId: string;
  grade: Grade;
};

function shuffleArray<T>(arr: T[]): T[] {
  return arr
    .map((value) => ({ value, sortKey: Math.random() }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ value }) => value);
}

export function DailyPage() {
  const [mode, setMode] = useState<Mode>("start");
  const [selectedMode, setSelectedMode] = useState<
    "card" | "audio" | "audioquiz"
  >("card");
  const [audioQuiz, setAudioQuiz] = useState<AudioQuizState | null>(null);
  const [pauseSeconds, setPauseSeconds] = useState<number>(
    DEFAULT_AUDIO_QUIZ_PAUSE_SECONDS,
  );
  const [selectedOrder, setSelectedOrder] = useState<Order>("default");
  const [dailyLimit, setDailyLimit] = useState(DEFAULT_DAILY_LIMIT);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [completedCount, setCompletedCount] = useState<number | null>(null);
  const [sessionCardIds, setSessionCardIds] = useState<string[] | null>(null);

  const [now, setNow] = useState(() => Date.now());

  const { data: rawDueCards } = useDueCards(now);
  const { data: decks } = useDecks();

  // このセッション限りのデッキ選択。初期値はデッキタブの include_in_daily。
  const [deckOverrides, setDeckOverrides] = useState<Record<string, boolean>>(
    {},
  );
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);

  const isDeckSelected = (deck: Deck) =>
    deckOverrides[deck.id] ?? deck.includeInDaily;

  const includedDeckIds = decks
    ? new Set(decks.filter(isDeckSelected).map((d) => d.id))
    : null;

  const dueCountByDeck = rawDueCards
    ? rawDueCards.reduce<Record<string, number>>((acc, card) => {
        acc[card.deckId] = (acc[card.deckId] ?? 0) + 1;
        return acc;
      }, {})
    : {};

  const dueCards =
    rawDueCards && includedDeckIds
      ? rawDueCards
          .filter((card) => includedDeckIds.has(card.deckId))
          .sort((a, b) => {
            if (a.state === 0 && b.state !== 0) return -1;
            if (a.state !== 0 && b.state === 0) return 1;
            return a.due - b.due;
          })
      : undefined;

  const deckNameMap = decks
    ? Object.fromEntries(decks.map((d) => [d.id, d.name]))
    : {};
  const deckLangMap = decks
    ? Object.fromEntries(
        decks.map((d) => [
          d.id,
          { frontLang: d.frontLang, backLang: d.backLang },
        ]),
      )
    : {};
  const deckBackLangMap = Object.fromEntries(
    Object.entries(deckLangMap).map(([id, langs]) => [id, langs.backLang]),
  );

  const totalDue = dueCards?.length ?? 0;

  const limitedCards = (() => {
    if (!dueCards) return [];
    if (sessionCardIds) {
      const cardMap = new Map(dueCards.map((c) => [c.id, c]));
      return sessionCardIds
        .map((id) => cardMap.get(id))
        .filter((c): c is NonNullable<typeof c> => c != null);
    }
    return dueCards.slice(0, dailyLimit);
  })();
  const currentCard = limitedCards[0] ?? null;

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
        setSessionResults((prev) => [
          ...prev,
          {
            cardId: currentCard.id,
            front: currentCard.front,
            deckId: currentCard.deckId,
            grade,
          },
        ]);
        setShowAnswer(false);
        setReviewedCount((c) => c + 1);
        setNow(Date.now());
      } finally {
        setIsRating(false);
      }
    },
    [currentCard, isRating],
  );

  const startAudioQuiz = useCallback(async () => {
    if (!dueCards || dueCards.length === 0) return;
    const pool = dueCards.slice(0, Math.min(dailyLimit, AUDIO_QUIZ_MAX_CARDS));
    const ordered = selectedOrder === "random" ? shuffleArray(pool) : pool;
    setMode("audioquiz");
    setAudioQuiz({ status: "preparing", done: 0, total: ordered.length * 2 });
    try {
      const session = await prepareAudioQuiz(
        ordered.map((c) => ({
          id: c.id,
          deckId: c.deckId,
          front: c.front,
          back: c.back,
          frontLang: deckLangMap[c.deckId]?.frontLang ?? "en",
          backLang: deckLangMap[c.deckId]?.backLang ?? "en",
        })),
        pauseSeconds,
        (done, total) => setAudioQuiz({ status: "preparing", done, total }),
      );
      setAudioQuiz({ status: "ready", session });
    } catch (err) {
      setAudioQuiz({
        status: "error",
        message:
          err instanceof Error ? err.message : "音声の準備に失敗しました",
      });
    }
  }, [dueCards, dailyLimit, selectedOrder, pauseSeconds, deckLangMap]);

  const handleStart = useCallback(() => {
    if (selectedMode === "audioquiz") {
      startAudioQuiz();
      return;
    }
    if (dueCards) {
      const ids = dueCards.slice(0, dailyLimit).map((c) => c.id);
      setSessionCardIds(selectedOrder === "random" ? shuffleArray(ids) : ids);
    }
    setMode(selectedMode);
    setReviewedCount(0);
    setCompletedCount(null);
    setSessionResults([]);
    setNow(Date.now());
  }, [selectedMode, selectedOrder, dueCards, dailyLimit, startAudioQuiz]);

  const handleAudioComplete = useCallback((count: number) => {
    setCompletedCount(count);
    setMode("start");
  }, []);

  const handleBackToStart = useCallback(() => {
    setMode("start");
    setReviewedCount(0);
    setSessionCardIds(null);
    setAudioQuiz(null);
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
              対象デッキ
            </label>
            <div className="space-y-2">
              {decks.map((deck) => (
                <label
                  key={deck.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={isDeckSelected(deck)}
                    onChange={(e) =>
                      setDeckOverrides((prev) => ({
                        ...prev,
                        [deck.id]: e.target.checked,
                      }))
                    }
                    className="size-4 accent-primary"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {deck.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {dueCountByDeck[deck.id] ?? 0} 枚
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              初期値はデッキタブの設定です。ここでの変更は今回だけ有効です
            </p>
          </div>

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
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { key: "card", label: "カード", icon: CreditCard },
                  { key: "audioquiz", label: "音声クイズ", icon: Headphones },
                  { key: "audio", label: "読み上げ", icon: Volume2 },
                ] as const
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setSelectedMode(key)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors",
                    selectedMode === key
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-6",
                      selectedMode === key
                        ? "text-primary"
                        : "text-muted-foreground",
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      selectedMode === key
                        ? "text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                </button>
              ))}
            </div>
            {selectedMode === "audioquiz" && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                表面 → ポーズ → 裏面 → ポーズ を繰り返す番組を作ります（最大{" "}
                {AUDIO_QUIZ_MAX_CARDS} 枚）。画面をロックしても再生が続きます
              </p>
            )}
          </div>

          {selectedMode === "audioquiz" && (
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                想起ポーズ
              </label>
              <div className="grid grid-cols-3 gap-3">
                {AUDIO_QUIZ_PAUSE_OPTIONS.map((seconds) => (
                  <button
                    key={seconds}
                    onClick={() => setPauseSeconds(seconds)}
                    className={cn(
                      "rounded-lg border-2 p-3 text-sm font-medium transition-colors",
                      pauseSeconds === seconds
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-muted-foreground/30",
                    )}
                  >
                    {seconds} 秒
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              カード順
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedOrder("default")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors",
                  selectedOrder === "default"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30",
                )}
              >
                <ArrowDownNarrowWide
                  className={cn(
                    "size-6",
                    selectedOrder === "default"
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    selectedOrder === "default"
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  期限順
                </span>
              </button>
              <button
                onClick={() => setSelectedOrder("random")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors",
                  selectedOrder === "random"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30",
                )}
              >
                <Shuffle
                  className={cn(
                    "size-6",
                    selectedOrder === "random"
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    selectedOrder === "random"
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  ランダム
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
          deckBackLangMap={deckBackLangMap}
          onComplete={handleAudioComplete}
        />
      </div>
    );
  }

  if (mode === "audioquiz") {
    return (
      <div className="px-4 pt-6">
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={handleBackToStart}
            className="text-muted-foreground hover:text-foreground"
          >
            ← 戻る
          </button>
          <h1 className="text-lg font-semibold">今日の学習（音声クイズ）</h1>
        </div>

        {audioQuiz?.status === "preparing" && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
            <div className="text-muted-foreground">
              音声を準備中… {audioQuiz.done} / {audioQuiz.total}
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{
                  width: `${(audioQuiz.done / Math.max(audioQuiz.total, 1)) * 100}%`,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              初回は読み上げの生成に少し時間がかかります
            </p>
          </div>
        )}

        {audioQuiz?.status === "error" && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6">
            <p className="text-center text-sm text-error">
              {audioQuiz.message}
            </p>
            <button
              onClick={handleBackToStart}
              className="text-primary underline"
            >
              スタートに戻る
            </button>
          </div>
        )}

        {audioQuiz?.status === "ready" && (
          <AudioQuizPlayer
            session={audioQuiz.session}
            deckNameMap={deckNameMap}
            onExit={handleBackToStart}
          />
        )}
      </div>
    );
  }

  if (!currentCard) {
    const worstByCard = sessionResults.reduce<Map<string, SessionResult>>(
      (map, result) => {
        const prev = map.get(result.cardId);
        if (!prev || result.grade < prev.grade) {
          map.set(result.cardId, result);
        }
        return map;
      },
      new Map(),
    );
    const struggled = [...worstByCard.values()];
    const againResults = struggled.filter((r) => r.grade === Rating.Again);
    const hardResults = struggled.filter((r) => r.grade === Rating.Hard);

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-8">
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

        {againResults.length > 0 || hardResults.length > 0 ? (
          <div className="w-full max-w-md space-y-4">
            {againResults.length > 0 && (
              <SessionSummaryList
                title="もう一度"
                titleClassName="text-grade-again"
                items={againResults}
                deckNameMap={deckNameMap}
              />
            )}
            {hardResults.length > 0 && (
              <SessionSummaryList
                title="難しかった"
                titleClassName="text-grade-hard"
                items={hardResults}
                deckNameMap={deckNameMap}
              />
            )}
          </div>
        ) : (
          reviewedCount > 0 && (
            <p className="text-sm text-muted-foreground">
              つまずいたカードはありませんでした
            </p>
          )
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

function SessionSummaryList({
  title,
  titleClassName,
  items,
  deckNameMap,
}: {
  title: string;
  titleClassName: string;
  items: SessionResult[];
  deckNameMap: Record<string, string>;
}) {
  return (
    <div>
      <h2 className={`mb-2 text-sm font-semibold ${titleClassName}`}>
        {title}（{items.length} 枚）
      </h2>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item.cardId}
            className="flex items-center gap-2 rounded-lg border p-2.5"
          >
            <span className="min-w-0 flex-1 truncate text-sm">
              {stripHtml(item.front)}
            </span>
            {deckNameMap[item.deckId] && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {deckNameMap[item.deckId]}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}
