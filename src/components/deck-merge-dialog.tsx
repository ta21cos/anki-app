"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { mergeDecks } from "@/lib/deck-merge";
import { Button } from "@/components/ui/button";
import { Merge, X, Check } from "lucide-react";

type MergeState =
  | { status: "idle" }
  | { status: "selecting" }
  | { status: "merging" }
  | { status: "success"; count: number }
  | { status: "error"; message: string };

export function DeckMergeDialog() {
  const [state, setState] = useState<MergeState>({ status: "idle" });
  const [targetId, setTargetId] = useState<string>("");
  const [sourceIds, setSourceIds] = useState<Set<string>>(new Set());

  const decks = useLiveQuery(() => db.decks.toArray());

  const toggleSource = (id: string) => {
    setSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleMerge = async () => {
    if (!targetId || sourceIds.size === 0) return;
    setState({ status: "merging" });
    try {
      const count = await mergeDecks(targetId, [...sourceIds]);
      setState({ status: "success", count });
      setTargetId("");
      setSourceIds(new Set());
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "マージに失敗しました",
      });
    }
  };

  if (state.status === "idle") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setState({ status: "selecting" })}
        className="gap-1.5"
      >
        <Merge className="size-4" />
        デッキをマージ
      </Button>
    );
  }

  if (state.status === "success") {
    return (
      <div className="rounded-lg border border-success-border bg-success-muted p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-success-muted-foreground">
            {state.count} 枚のカードをマージしました
          </p>
          <button onClick={() => setState({ status: "idle" })}>
            <X className="size-4 text-success" />
          </button>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-lg border border-error-border bg-error-muted p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-error-muted-foreground">
            {state.message}
          </p>
          <button onClick={() => setState({ status: "idle" })}>
            <X className="size-4 text-error" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">デッキをマージ</h3>
        <button onClick={() => setState({ status: "idle" })}>
          <X className="size-4 text-muted-foreground" />
        </button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">マージ先</p>
        <div className="space-y-1">
          {decks?.map((deck) => (
            <label
              key={deck.id}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
            >
              <input
                type="radio"
                name="target"
                value={deck.id}
                checked={targetId === deck.id}
                onChange={() => {
                  setTargetId(deck.id);
                  setSourceIds((prev) => {
                    const next = new Set(prev);
                    next.delete(deck.id);
                    return next;
                  });
                }}
              />
              {deck.name}
            </label>
          ))}
        </div>
      </div>

      {targetId && (
        <div>
          <p className="mb-2 text-sm font-medium">マージ元（複数選択可）</p>
          <div className="space-y-1">
            {decks
              ?.filter((d) => d.id !== targetId)
              .map((deck) => (
                <label
                  key={deck.id}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={sourceIds.has(deck.id)}
                    onChange={() => toggleSource(deck.id)}
                  />
                  {deck.name}
                </label>
              ))}
          </div>
        </div>
      )}

      <Button
        className="w-full gap-1.5"
        onClick={handleMerge}
        disabled={
          !targetId || sourceIds.size === 0 || state.status === "merging"
        }
      >
        <Check className="size-4" />
        {state.status === "merging" ? "マージ中..." : "マージ実行"}
      </Button>
    </div>
  );
}
