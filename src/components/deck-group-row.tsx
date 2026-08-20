import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import { TriStateCheckbox } from "@/components/tri-state-checkbox";
import type { SelectionState } from "@/lib/deck-tree";

interface DeckGroupRowProps {
  name: string;
  deckCount: number;
  cardCount?: number;
  dueCount: number;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  selection: SelectionState;
  onSelectAll: (next: boolean) => void;
  isDisabled?: boolean;
}

// NOTE: `親::子` 記法のグループ 1 行。子デッキの一括選択と開閉を持つ。
export function DeckGroupRow({
  name,
  deckCount,
  cardCount,
  dueCount,
  isExpanded,
  onToggleExpanded,
  selection,
  onSelectAll,
  isDisabled,
}: DeckGroupRowProps) {
  const Chevron = isExpanded ? ChevronDown : ChevronRight;
  return (
    <div className="flex items-center rounded-lg border bg-muted/40">
      <label className="flex shrink-0 items-center self-stretch pl-4 pr-1">
        <TriStateCheckbox
          state={selection}
          onChange={onSelectAll}
          isDisabled={isDisabled}
          label={`「${name}」のデッキをすべて選択`}
        />
      </label>
      <button
        type="button"
        onClick={onToggleExpanded}
        aria-expanded={isExpanded}
        className="flex min-w-0 flex-1 items-center justify-between gap-2 p-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Chevron className="size-4 shrink-0 text-muted-foreground" />
          <Folder className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {deckCount} デッキ
            {cardCount !== undefined && ` / ${cardCount} 枚`}
          </span>
          {dueCount > 0 && (
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
              {dueCount}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}
