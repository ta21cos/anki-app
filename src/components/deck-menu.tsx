"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Trash2, Volume2 } from "lucide-react";
import { deleteDeck } from "@/lib/api/mutations";

interface DeckMenuProps {
  deckId: string;
  deckName: string;
}

export function DeckMenu({ deckId, deckName }: DeckMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDelete(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const handleDelete = async () => {
    await deleteDeck(deckId);
    setOpen(false);
    setConfirmDelete(false);
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
          setConfirmDelete(false);
        }}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="デッキメニュー"
      >
        <MoreVertical className="size-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-lg border bg-card shadow-lg">
          {confirmDelete ? (
            <div className="p-3">
              <p className="mb-2 text-xs text-muted-foreground">
                「{deckName}」を削除しますか？カードもすべて削除されます。
              </p>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setConfirmDelete(false);
                  }}
                  className="flex-1 rounded-md bg-secondary px-2 py-1.5 text-xs font-medium transition-colors hover:bg-secondary/80"
                >
                  キャンセル
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete();
                  }}
                  className="flex-1 rounded-md bg-destructive px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-destructive/90"
                >
                  削除
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  router.push(`/listen/${deckId}`);
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-accent"
              >
                <Volume2 className="size-4" />
                読み上げ
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  router.push(`/deck/${deckId}/edit`);
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-accent"
              >
                <Pencil className="size-4" />
                編集
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirmDelete(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-accent"
              >
                <Trash2 className="size-4" />
                削除
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
