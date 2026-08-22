import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  useDecks,
  useDeckCounts,
  type Deck,
  type DeckCounts,
} from "@/lib/api/hooks";
import { setDeckIncludeInDaily } from "@/lib/api/mutations";
import { BookOpen } from "lucide-react";
import { DeckMergeDialog } from "@/components/deck-merge-dialog";
import { DeckMenu } from "@/components/deck-menu";
import { DeckGroupRow } from "@/components/deck-group-row";
import { groupDecks, selectionState } from "@/lib/deck-tree";
import { formatLangPair } from "@/lib/lang";

type CountMap = Record<string, DeckCounts>;

export function HomePage() {
  const [now] = useState(() => Date.now());
  const { data: decks } = useDecks();
  const { data: countList } = useDeckCounts(now);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );
  // NOTE: 一括切り替えは子デッキの数だけ PATCH が飛ぶので、応答を待たずに
  // 表示を進める。確定後は取得し直したデッキの値に戻す。
  const [pendingGroups, setPendingGroups] = useState<Record<string, boolean>>(
    {},
  );

  const counts: CountMap = countList
    ? Object.fromEntries(countList.map((row) => [row.deckId, row]))
    : {};

  if (decks === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  if (decks.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6">
        <BookOpen className="size-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">デッキがありません</h1>
        <p className="text-center text-muted-foreground">
          インポートタブからカードを追加しましょう
        </p>
      </div>
    );
  }

  const groups = groupDecks(decks);

  const handleSelectGroup = async (
    groupName: string,
    groupDeckList: Deck[],
    next: boolean,
  ) => {
    setPendingGroups((prev) => ({ ...prev, [groupName]: next }));
    try {
      await Promise.all(
        groupDeckList
          .filter((deck) => deck.includeInDaily !== next)
          .map((deck) => setDeckIncludeInDaily(deck.id, next)),
      );
    } finally {
      setPendingGroups((prev) =>
        Object.fromEntries(
          Object.entries(prev).filter(([name]) => name !== groupName),
        ),
      );
    }
  };

  return (
    <div className="px-4 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">デッキ</h1>
        {decks.length >= 2 && <DeckMergeDialog />}
      </div>
      <div className="space-y-3">
        {groups.map((group) => {
          const groupName = group.name;
          if (groupName === null) {
            return group.decks.map(({ deck, label }) => (
              <DeckItem
                key={deck.id}
                deck={deck}
                label={label}
                counts={counts[deck.id]}
              />
            ));
          }

          const groupDeckList = group.decks.map(({ deck }) => deck);
          const isExpanded = expandedGroups[groupName] ?? false;
          const totals = groupDeckList.reduce(
            (acc, deck) => ({
              total: acc.total + (counts[deck.id]?.total ?? 0),
              due: acc.due + (counts[deck.id]?.due ?? 0),
            }),
            { total: 0, due: 0 },
          );

          return (
            <div key={groupName} className="space-y-2">
              <DeckGroupRow
                name={groupName}
                deckCount={groupDeckList.length}
                cardCount={countList ? totals.total : undefined}
                dueCount={totals.due}
                isExpanded={isExpanded}
                onToggleExpanded={() =>
                  setExpandedGroups((prev) => ({
                    ...prev,
                    [groupName]: !isExpanded,
                  }))
                }
                selection={
                  pendingGroups[groupName] === undefined
                    ? selectionState(
                        groupDeckList.map((deck) => deck.includeInDaily),
                      )
                    : pendingGroups[groupName]
                      ? "all"
                      : "none"
                }
                onSelectAll={(next) =>
                  handleSelectGroup(groupName, groupDeckList, next)
                }
              />
              {isExpanded && (
                <div className="space-y-2 pl-4">
                  {group.decks.map(({ deck, label }) => (
                    <DeckItem
                      key={deck.id}
                      deck={deck}
                      label={label}
                      counts={counts[deck.id]}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DeckItem({
  deck,
  label,
  counts,
}: {
  deck: Deck;
  label: string;
  counts?: DeckCounts;
}) {
  const cardCount = counts?.total ?? 0;
  const dueCount = counts?.due ?? 0;

  const [pendingInclude, setPendingInclude] = useState<boolean | null>(null);
  const includeInDaily = pendingInclude ?? deck.includeInDaily;

  const handleToggleInclude = async (next: boolean) => {
    setPendingInclude(next);
    try {
      await setDeckIncludeInDaily(deck.id, next);
    } finally {
      setPendingInclude(null);
    }
  };

  return (
    <div className="flex items-center rounded-lg border transition-colors hover:bg-accent">
      <label
        className="flex shrink-0 items-center self-stretch pl-4 pr-1"
        aria-label={`「${deck.name}」を学習セッションに含める`}
      >
        <input
          type="checkbox"
          checked={includeInDaily}
          disabled={pendingInclude !== null}
          onChange={(e) => handleToggleInclude(e.target.checked)}
          className="size-4 accent-primary"
        />
      </label>
      <Link
        to="/study/$deckId"
        params={{ deckId: deck.id }}
        className="flex min-w-0 flex-1 items-center justify-between p-4"
      >
        <div className="min-w-0">
          <h2 className="truncate font-medium">{label}</h2>
          <p className="text-sm text-muted-foreground">
            {cardCount} 枚
            <span
              className="ml-2 rounded border px-1.5 py-0.5 text-xs"
              aria-label={`読み上げ言語 ${formatLangPair(deck.frontLang, deck.backLang)}`}
            >
              {formatLangPair(deck.frontLang, deck.backLang)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dueCount > 0 && (
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
              {dueCount}
            </span>
          )}
        </div>
      </Link>
      <div className="pr-3">
        <DeckMenu deckId={deck.id} deckName={deck.name} />
      </div>
    </div>
  );
}
