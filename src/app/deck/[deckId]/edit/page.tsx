"use client";

import { useState, use } from "react";
import { useDeck, useDeckCards } from "@/lib/api/hooks";
import {
  updateDeckName,
  updateCard,
  addCard,
  deleteCard,
  deleteDeck,
} from "@/lib/api/mutations";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Check, Pencil, X, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface EditingCard {
  id: string | null;
  front: string;
  back: string;
}

export default function DeckEditPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = use(params);
  const router = useRouter();

  const { data: deck, isLoading: deckLoading } = useDeck(deckId);
  const { data: cards, isLoading: cardsLoading } = useDeckCards(deckId);

  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<EditingCard | null>(null);
  const [savingCard, setSavingCard] = useState(false);

  const displayName = name ?? deck?.name ?? "";

  const handleSaveName = async () => {
    if (!deck || !displayName.trim() || displayName === deck.name) return;
    setSaving(true);
    await updateDeckName(deckId, displayName.trim());
    setSaving(false);
    setName(null);
  };

  const handleDeleteCard = async (cardId: string) => {
    setDeletingCardId(cardId);
    await deleteCard(cardId);
    setDeletingCardId(null);
  };

  const handleEditCard = (card: {
    id: string;
    front: string;
    back: string;
  }) => {
    setEditingCard({ id: card.id, front: card.front, back: card.back });
  };

  const handleAddCard = () => {
    setEditingCard({ id: null, front: "", back: "" });
  };

  const handleSaveCard = async () => {
    if (!editingCard || !editingCard.front.trim() || !editingCard.back.trim())
      return;
    setSavingCard(true);

    if (editingCard.id) {
      await updateCard(editingCard.id, {
        front: editingCard.front.trim(),
        back: editingCard.back.trim(),
      });
    } else {
      const now = Date.now();
      await addCard(deckId, {
        id: crypto.randomUUID(),
        front: editingCard.front.trim(),
        back: editingCard.back.trim(),
        due: now,
        stability: 0,
        difficulty: 0,
        reps: 0,
        lapses: 0,
        state: 0,
        lastReview: null,
        createdAt: now,
      });
    }

    setSavingCard(false);
    setEditingCard(null);
  };

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
            カード一覧（{cards?.length ?? 0} 枚）
          </h2>
          <Button size="xs" variant="outline" onClick={handleAddCard}>
            <Plus className="size-3.5" />
            追加
          </Button>
        </div>

        {editingCard && editingCard.id === null && (
          <CardEditForm
            editingCard={editingCard}
            setEditingCard={setEditingCard}
            onSave={handleSaveCard}
            onCancel={() => setEditingCard(null)}
            saving={savingCard}
            isNew
          />
        )}

        {(!cards || cards.length === 0) && !editingCard ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            カードがありません
          </p>
        ) : (
          <div className="space-y-2">
            {cards?.map((card) =>
              editingCard?.id === card.id ? (
                <CardEditForm
                  key={card.id}
                  editingCard={editingCard}
                  setEditingCard={setEditingCard}
                  onSave={handleSaveCard}
                  onCancel={() => setEditingCard(null)}
                  saving={savingCard}
                />
              ) : (
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
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => handleEditCard(card)}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-label="カードを編集"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCard(card.id)}
                      disabled={deletingCardId === card.id}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-error-muted hover:text-error disabled:opacity-50"
                      aria-label="カードを削除"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </section>

      <div className="mt-8 pb-4">
        <Button
          variant="destructive"
          className="w-full"
          onClick={async () => {
            await deleteDeck(deckId);
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

function CardEditForm({
  editingCard,
  setEditingCard,
  onSave,
  onCancel,
  saving,
  isNew,
}: {
  editingCard: EditingCard;
  setEditingCard: (card: EditingCard) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isNew?: boolean;
}) {
  const canSave = editingCard.front.trim() && editingCard.back.trim();

  return (
    <div className="rounded-lg border border-ring/50 bg-accent/30 p-3">
      <div className="mb-2">
        <label className="mb-0.5 block text-xs font-medium text-muted-foreground">
          表面
        </label>
        <textarea
          value={editingCard.front}
          onChange={(e) =>
            setEditingCard({ ...editingCard, front: e.target.value })
          }
          rows={2}
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />
      </div>
      <div className="mb-3">
        <label className="mb-0.5 block text-xs font-medium text-muted-foreground">
          裏面
        </label>
        <textarea
          value={editingCard.back}
          onChange={(e) =>
            setEditingCard({ ...editingCard, back: e.target.value })
          }
          rows={2}
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="xs" variant="ghost" onClick={onCancel}>
          <X className="size-3.5" />
          キャンセル
        </Button>
        <Button size="xs" disabled={!canSave || saving} onClick={onSave}>
          <Check className="size-3.5" />
          {isNew ? "追加" : "保存"}
        </Button>
      </div>
    </div>
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}
