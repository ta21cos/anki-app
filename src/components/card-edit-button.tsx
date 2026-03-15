"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/db";
import { Pencil, X, Check } from "lucide-react";

interface CardEditDialogProps {
  cardId: string;
  front: string;
  back: string;
  onClose: () => void;
}

function CardEditDialog({ cardId, front, back, onClose }: CardEditDialogProps) {
  const [editFront, setEditFront] = useState(front);
  const [editBack, setEditBack] = useState(back);
  const [saving, setSaving] = useState(false);
  const frontRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    frontRef.current?.focus();
  }, []);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await db.cards.update(cardId, {
        front: editFront.trim(),
        back: editBack.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">カードを編集</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>

        <label className="mb-1 block text-sm text-muted-foreground">表面</label>
        <textarea
          ref={frontRef}
          value={editFront}
          onChange={(e) => setEditFront(e.target.value)}
          rows={3}
          className="mb-3 w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />

        <label className="mb-1 block text-sm text-muted-foreground">裏面</label>
        <textarea
          value={editBack}
          onChange={(e) => setEditBack(e.target.value)}
          rows={3}
          className="mb-4 w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm transition-colors hover:bg-accent"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (!editFront.trim() && !editBack.trim())}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Check className="size-3.5" />
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

interface CardEditButtonProps {
  cardId: string;
  front: string;
  back: string;
}

export function CardEditButton({ cardId, front, back }: CardEditButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Pencil className="size-3" />
        編集
      </button>
      {open && (
        <CardEditDialog
          cardId={cardId}
          front={front}
          back={back}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
