"use client";

import { useState, useEffect, useRef, useCallback, type RefObject } from "react";
import { db } from "@/lib/db";
import { Pencil, X, Check, Highlighter } from "lucide-react";

function insertMark(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  setValue: (v: string) => void,
) {
  const el = ref.current;
  if (!el) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const selected = value.slice(start, end);
  const replacement = `<mark>${selected}</mark>`;
  const next = value.slice(0, start) + replacement + value.slice(end);
  setValue(next);
  // Restore cursor after React re-render
  requestAnimationFrame(() => {
    const cursorPos = selected
      ? start + replacement.length
      : start + "<mark>".length;
    el.setSelectionRange(cursorPos, cursorPos);
    el.focus();
  });
}

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
  const backRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    frontRef.current?.focus();
  }, []);

  const handleSave = useCallback(async () => {
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
  }, [saving, cardId, editFront, editBack, onClose]);

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

        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm text-muted-foreground">表面</label>
          <button
            type="button"
            onClick={() => insertMark(frontRef, editFront, setEditFront)}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="選択範囲をマーカーで囲む"
          >
            <Highlighter className="size-3" />
            mark
          </button>
        </div>
        <textarea
          ref={frontRef}
          value={editFront}
          onChange={(e) => setEditFront(e.target.value)}
          rows={3}
          className="mb-3 w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />

        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm text-muted-foreground">裏面</label>
          <button
            type="button"
            onClick={() => insertMark(backRef, editBack, setEditBack)}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="選択範囲をマーカーで囲む"
          >
            <Highlighter className="size-3" />
            mark
          </button>
        </div>
        <textarea
          ref={backRef}
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
