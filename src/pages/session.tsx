import { useState, useCallback } from "react";
import {
  useDecks,
  useDeckCounts,
  useSessionCards,
  type Card,
  type Deck,
} from "@/lib/api/hooks";
import { orderByDueDay } from "@/lib/card-order";
import { Link } from "@tanstack/react-router";
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
import { AutoSpeakToggle } from "@/components/auto-speak-toggle";
import { useAutoSpeak } from "@/lib/use-auto-speak";
import { useSettings } from "@/lib/settings";
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
import { DeckGroupRow } from "@/components/deck-group-row";
import { groupDecks, selectionState } from "@/lib/deck-tree";
import { cn } from "@/lib/utils";

const DEFAULT_SESSION_LIMIT = 20;
const MIN_LIMIT = 5;
const MAX_LIMIT = 100;
const STEP = 5;

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

// 期限切れを優先し、学習枚数に満たない分だけ期限前のカードを先取りする。
function buildPool({
  due,
  upcoming,
  limit,
  borrowAhead,
}: {
  due: Card[];
  upcoming: Card[];
  limit: number;
  borrowAhead: boolean;
}): { cards: Card[]; borrowCount: number } {
  const dueOrdered = orderByDueDay(due).slice(0, limit);
  const borrowCount = borrowAhead
    ? Math.min(Math.max(limit - dueOrdered.length, 0), upcoming.length)
    : 0;
  return {
    cards: [...dueOrdered, ...upcoming.slice(0, borrowCount)],
    borrowCount,
  };
}

export function SessionPage() {
  const [mode, setMode] = useState<Mode>("start");
  const [selectedMode, setSelectedMode] = useState<
    "card" | "audio" | "audioquiz"
  >("card");
  const [audioQuiz, setAudioQuiz] = useState<AudioQuizState | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );
  const { recallPauseSeconds, cardGapSeconds } = useSettings();
  const [selectedOrder, setSelectedOrder] = useState<Order>("default");
  const [sessionLimit, setSessionLimit] = useState(DEFAULT_SESSION_LIMIT);
  const [borrowAhead, setBorrowAhead] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [completedCount, setCompletedCount] = useState<number | null>(null);
  const [sessionCardIds, setSessionCardIds] = useState<string[] | null>(null);

  const [now, setNow] = useState(() => Date.now());

  const { data: decks } = useDecks();
  const { data: deckCounts } = useDeckCounts(now);

  // このセッション限りのデッキ選択。初期値はデッキタブの include_in_daily。
  const [deckOverrides, setDeckOverrides] = useState<Record<string, boolean>>(
    {},
  );
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);

  const isDeckSelected = (deck: Deck) =>
    deckOverrides[deck.id] ?? deck.includeInDaily;

  const includedDeckIds = decks
    ? decks.filter(isDeckSelected).map((d) => d.id)
    : null;

  const { data: sessionCards } = useSessionCards(
    now,
    borrowAhead ? sessionLimit : 0,
    includedDeckIds,
  );

  const dueCountByDeck = deckCounts
    ? Object.fromEntries(deckCounts.map((c) => [c.deckId, c.due]))
    : {};

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

  const totalDue = sessionCards?.due.length ?? 0;

  // NOTE: 開始前の枚数表示用。出題順は handleStart で一度だけ確定させるので、
  // ここでのランダム並びは表示に影響しない。
  const preview = sessionCards
    ? buildPool({
        due: sessionCards.due,
        upcoming: sessionCards.upcoming,
        limit: sessionLimit,
        borrowAhead,
      })
    : { cards: [], borrowCount: 0 };
  const poolSize = preview.cards.length;

  const limitedCards = (() => {
    if (!sessionCards || !sessionCardIds) return [];
    const cardMap = new Map(
      [...sessionCards.due, ...sessionCards.upcoming].map((c) => [c.id, c]),
    );
    return sessionCardIds
      .map((id) => cardMap.get(id))
      .filter((c): c is NonNullable<typeof c> => c != null);
  })();
  const currentCard = limitedCards[0] ?? null;

  useAutoSpeak(
    currentCard
      ? {
          id: currentCard.id,
          front: currentCard.front,
          back: currentCard.back,
          frontLang: deckLangMap[currentCard.deckId]?.frontLang ?? "en",
          backLang: deckLangMap[currentCard.deckId]?.backLang ?? "en",
        }
      : null,
    mode === "card" && showAnswer,
  );

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
        // NOTE: 評価後のカードは期限前カードとして再取得される可能性があるため、
        // 再取得に頼らずセッションの出題列から明示的に外す。
        setSessionCardIds((prev) =>
          prev ? prev.filter((id) => id !== currentCard.id) : prev,
        );
        setShowAnswer(false);
        setReviewedCount((c) => c + 1);
        setNow(Date.now());
      } finally {
        setIsRating(false);
      }
    },
    [currentCard, isRating],
  );

  const buildSessionCards = useCallback(() => {
    if (!sessionCards) return [];
    const { cards } = buildPool({
      due: sessionCards.due,
      upcoming: sessionCards.upcoming,
      limit: sessionLimit,
      borrowAhead,
    });
    return selectedOrder === "random" ? shuffleArray(cards) : cards;
  }, [sessionCards, sessionLimit, borrowAhead, selectedOrder]);

  const startAudioQuiz = useCallback(async () => {
    const ordered = buildSessionCards().slice(0, AUDIO_QUIZ_MAX_CARDS);
    if (ordered.length === 0) return;
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
        { pauseSeconds: recallPauseSeconds, gapSeconds: cardGapSeconds },
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
  }, [buildSessionCards, recallPauseSeconds, cardGapSeconds, deckLangMap]);

  const handleStart = useCallback(() => {
    if (selectedMode === "audioquiz") {
      startAudioQuiz();
      return;
    }
    setSessionCardIds(buildSessionCards().map((c) => c.id));
    setMode(selectedMode);
    setReviewedCount(0);
    setCompletedCount(null);
    setSessionResults([]);
    setNow(Date.now());
  }, [selectedMode, buildSessionCards, startAudioQuiz]);

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

  if (sessionCards === undefined || decks === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  if (mode === "start") {
    return (
      <div className="px-4 pt-6">
        <h1 className="mb-6 text-lg font-semibold">学習</h1>

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
              {groupDecks(decks).map((group) => {
                const groupName = group.name;
                if (groupName === null) {
                  return group.decks.map(({ deck, label }) => (
                    <DeckCheckbox
                      key={deck.id}
                      label={label}
                      dueCount={dueCountByDeck[deck.id] ?? 0}
                      isSelected={isDeckSelected(deck)}
                      onChange={(next) =>
                        setDeckOverrides((prev) => ({
                          ...prev,
                          [deck.id]: next,
                        }))
                      }
                    />
                  ));
                }

                const groupDeckList = group.decks.map(({ deck }) => deck);
                const isExpanded = expandedGroups[groupName] ?? false;
                const groupDue = groupDeckList.reduce(
                  (sum, deck) => sum + (dueCountByDeck[deck.id] ?? 0),
                  0,
                );

                return (
                  <div key={groupName} className="space-y-2">
                    <DeckGroupRow
                      name={groupName}
                      deckCount={groupDeckList.length}
                      dueCount={groupDue}
                      isExpanded={isExpanded}
                      onToggleExpanded={() =>
                        setExpandedGroups((prev) => ({
                          ...prev,
                          [groupName]: !isExpanded,
                        }))
                      }
                      selection={selectionState(
                        groupDeckList.map(isDeckSelected),
                      )}
                      onSelectAll={(next) =>
                        setDeckOverrides((prev) => ({
                          ...prev,
                          ...Object.fromEntries(
                            groupDeckList.map((deck) => [deck.id, next]),
                          ),
                        }))
                      }
                    />
                    {isExpanded && (
                      <div className="space-y-2 pl-4">
                        {group.decks.map(({ deck, label }) => (
                          <DeckCheckbox
                            key={deck.id}
                            label={label}
                            dueCount={dueCountByDeck[deck.id] ?? 0}
                            isSelected={isDeckSelected(deck)}
                            onChange={(next) =>
                              setDeckOverrides((prev) => ({
                                ...prev,
                                [deck.id]: next,
                              }))
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
                  setSessionLimit((l) => Math.max(MIN_LIMIT, l - STEP))
                }
                disabled={sessionLimit <= MIN_LIMIT}
                aria-label="学習枚数を減らす"
                className="rounded-md border p-2 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
              >
                <Minus className="size-4" />
              </button>
              <span className="min-w-[3rem] text-center text-lg font-semibold">
                {sessionLimit}
              </span>
              <button
                onClick={() =>
                  setSessionLimit((l) => Math.min(MAX_LIMIT, l + STEP))
                }
                disabled={sessionLimit >= MAX_LIMIT}
                aria-label="学習枚数を増やす"
                className="rounded-md border p-2 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
              >
                <Plus className="size-4" />
              </button>
              <span className="text-sm text-muted-foreground">
                / {poolSize} 枚
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              期限切れ {totalDue} 枚
            </p>
            <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={borrowAhead}
                onChange={(e) => setBorrowAhead(e.target.checked)}
                className="size-4 accent-primary"
              />
              期限前のカードも先取りする
            </label>
            {preview.borrowCount > 0 && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                期限前のカード {preview.borrowCount} 枚を先取りします
              </p>
            )}
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
            {selectedMode === "audioquiz" && (
              <p className="mt-1 text-xs text-muted-foreground">
                想起ポーズ {recallPauseSeconds} 秒 / カード間 {cardGapSeconds}{" "}
                秒（
                <Link to="/settings" className="text-primary underline">
                  設定
                </Link>
                で変更）
              </p>
            )}
          </div>

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
            disabled={poolSize === 0}
            className="w-full gap-2"
            size="lg"
          >
            <Play className="size-4" />
            学習を始める
          </Button>

          {poolSize === 0 && (
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
          <h1 className="text-lg font-semibold">学習（音声）</h1>
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
          <h1 className="text-lg font-semibold">学習（音声クイズ）</h1>
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
          {reviewedCount > 0 ? "学習完了！" : "復習するカードがありません"}
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
            <h1 className="text-lg font-semibold">学習</h1>
          </div>
          <div className="flex items-center gap-2">
            <AutoSpeakToggle />
            <span className="text-sm text-muted-foreground">
              残り {remaining} 枚
              {totalDue > sessionLimit && (
                <span className="ml-1 text-xs">(全{totalDue}枚中)</span>
              )}
            </span>
          </div>
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

function DeckCheckbox({
  label,
  dueCount,
  isSelected,
  onChange,
}: {
  label: string;
  dueCount: number;
  isSelected: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors hover:bg-accent">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-primary"
      />
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {dueCount} 枚
      </span>
    </label>
  );
}
