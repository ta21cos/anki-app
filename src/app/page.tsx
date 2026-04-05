"use client";

import { useState } from "react";
import { useDecks, useDeckCardCount, useDeckDueCount } from "@/lib/api/hooks";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { DeckMergeDialog } from "@/components/deck-merge-dialog";
import { DeckMenu } from "@/components/deck-menu";

export default function HomePage() {
  const { data: decks } = useDecks();

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

  return (
    <div className="px-4 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">デッキ</h1>
        {decks.length >= 2 && <DeckMergeDialog />}
      </div>
      <div className="space-y-3">
        {decks.map((deck) => (
          <DeckItem key={deck.id} deck={deck} />
        ))}
      </div>
    </div>
  );
}

function DeckItem({ deck }: { deck: { id: string; name: string } }) {
  const { data: cardCountData } = useDeckCardCount(deck.id);
  const cardCount = cardCountData?.count ?? 0;

  const [now] = useState(() => Date.now());
  const { data: dueCountData } = useDeckDueCount(deck.id, now);
  const dueCount = dueCountData?.count ?? 0;

  return (
    <div className="flex items-center rounded-lg border transition-colors hover:bg-accent">
      <Link
        href={`/study/${deck.id}`}
        className="flex min-w-0 flex-1 items-center justify-between p-4"
      >
        <div className="min-w-0">
          <h2 className="font-medium">{deck.name}</h2>
          <p className="text-sm text-muted-foreground">{cardCount} 枚</p>
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
