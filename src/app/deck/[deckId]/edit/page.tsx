"use client";

import { useState, use } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { ArrowLeft, Trash2, Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DeckEditPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = use(params);
  const router = useRouter();

  const deckResult = useLiveQuery(
    () => db.decks.get(deckId).then((d) => d ?? null),
    [deckId],
  );
  const cards = useLiveQuery(
    () => db.cards.where("deckId").equals(deckId).toArray(),
    [deckId],
  );

  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);

  const deck = deckResult === undefined ? undefined : deckResult;
  const displayName = name ?? deck?.name ?? "";

  const handleSaveName = async () => {
    if (!deck || !displayName.trim() || displayName === deck.name) return;
    setSaving(true);
    await db.decks.update(deckId, { name: displayName.trim() });
    setSaving(false);
    setName(null);
  };

  const handleDeleteCard = async (cardId: string) => {
    setDeletingCardId(cardId);
    await db.cards.delete(cardId);
    setDeletingCardId(null);
  };

  if (deckResult === undefined || cards === undefined) {
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

  const nameChanged = name !== null && name.trim() !== deck.name;

  return (
    <div className="px-4 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-semibold">デッキ編集</h1>
      </div>

      <section className="mb-6">
        <label
          htmlFor="deck-name-edit"
          className="mb-1 block text-sm font-medium"
        >
          デッキ名
        </label>
        <div className="flex gap-2">
          <input
            id="deck-name-edit"
            type="text"
            value={displayName}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            size="sm"
            disabled={!nameChanged || saving}
            onClick={handleSaveName}
            className="gap-1"
          >
            <Check className="size-4" />
            保存
          </Button>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">
            カード一覧（{cards.length} 枚）
          </h2>
        </div>

        {cards.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            カードがありません
          </p>
        ) : (
          <div className="space-y-2">
            {cards.map((card) => (
              <div
                key={card.id}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {stripHtml(card.front)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {stripHtml(card.back)}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteCard(card.id)}
                  disabled={deletingCardId === card.id}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-error-muted hover:text-error disabled:opacity-50"
                  aria-label="カードを削除"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-8 pb-4">
        <Button
          variant="destructive"
          className="w-full"
          onClick={async () => {
            await db.transaction("rw", db.decks, db.cards, async () => {
              await db.cards.where("deckId").equals(deckId).delete();
              await db.decks.delete(deckId);
            });
            router.push("/");
          }}
        >
          <Trash2 className="size-4" />
          デッキを削除
        </Button>
      </div>
    </div>
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}
