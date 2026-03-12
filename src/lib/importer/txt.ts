export interface ParsedCard {
  front: string;
  back: string;
}

export function parseTxt(content: string): ParsedCard[] {
  const lines = content.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    throw new Error("ファイルが空です");
  }

  const cards: ParsedCard[] = [];
  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length < 2) continue;
    const front = parts[0].trim();
    const back = parts.slice(1).join("\t").trim();
    if (front && back) {
      cards.push({ front, back });
    }
  }

  if (cards.length === 0) {
    throw new Error(
      "有効なカードが見つかりません。タブ区切り形式を確認してください",
    );
  }

  return cards;
}
