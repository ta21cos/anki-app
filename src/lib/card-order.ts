import type { Card } from "@/lib/api/hooks";

// ローカル時刻での年月日キー。同じ日の期限を同一グループとして扱うために使う。
export function localDayKey(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (const i of items.keys()) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function sortByDueDayShuffled(cards: Card[]): Card[] {
  const groups = new Map<string, Card[]>();
  for (const card of [...cards].sort((a, b) => a.due - b.due)) {
    const key = localDayKey(card.due);
    groups.set(key, [...(groups.get(key) ?? []), card]);
  }
  return [...groups.values()].flatMap((group) => shuffleInPlace(group));
}

// 新規カードを先頭に、残りを期限順に並べる。同じ日に期限を迎えるカード同士は
// ランダムに並べ、毎回同じ順で出題されるのを避ける。
export function orderByDueDay(cards: Card[]): Card[] {
  return [
    ...sortByDueDayShuffled(cards.filter((card) => card.state === 0)),
    ...sortByDueDayShuffled(cards.filter((card) => card.state !== 0)),
  ];
}
