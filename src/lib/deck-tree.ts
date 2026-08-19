import type { Deck } from "@/lib/api/hooks";

// NOTE: Anki と同じ `親::子` 記法。階層はデッキ名から導出するので、
// 名前を変えることがそのままグループの移動になる。
export const DECK_SEPARATOR = "::";

export type DeckGroup = {
  // グループ名。`::` を含まないデッキは name: null にまとめる
  name: string | null;
  decks: Array<{ deck: Deck; label: string }>;
};

export function splitDeckName(name: string): {
  group: string | null;
  label: string;
} {
  const index = name.indexOf(DECK_SEPARATOR);
  if (index === -1) return { group: null, label: name };
  const group = name.slice(0, index).trim();
  const label = name.slice(index + DECK_SEPARATOR.length).trim();
  // 「::子」や「親::」のように片側が空なら、階層とみなさない
  if (!group || !label) return { group: null, label: name };
  return { group, label };
}

// グループの登場順は decks の並び順に従う。worker が名前順で返すため、
// 同じグループのデッキは隣り合って並ぶ。
export function groupDecks(decks: Deck[]): DeckGroup[] {
  const groups: DeckGroup[] = [];
  const byName = new Map<string | null, DeckGroup>();

  decks.forEach((deck) => {
    const { group, label } = splitDeckName(deck.name);
    const existing = byName.get(group);
    if (existing) {
      existing.decks.push({ deck, label });
      return;
    }
    const created: DeckGroup = { name: group, decks: [{ deck, label }] };
    byName.set(group, created);
    groups.push(created);
  });

  return groups;
}

export type SelectionState = "all" | "some" | "none";

export function selectionState(selected: boolean[]): SelectionState {
  if (selected.length === 0 || selected.every((value) => !value)) return "none";
  return selected.every(Boolean) ? "all" : "some";
}
