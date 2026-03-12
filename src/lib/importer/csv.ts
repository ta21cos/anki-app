import Papa from "papaparse";
import type { ParsedCard } from "./txt";

export function parseCsv(content: string): ParsedCard[] {
  const result = Papa.parse<string[]>(content, {
    skipEmptyLines: true,
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    throw new Error(`CSV パースエラー: ${result.errors[0].message}`);
  }

  const rows = result.data;
  if (rows.length === 0) {
    throw new Error("ファイルが空です");
  }

  let startIndex = 0;
  const firstRow = rows[0];
  if (
    firstRow.length >= 2 &&
    firstRow[0].toLowerCase() === "front" &&
    firstRow[1].toLowerCase() === "back"
  ) {
    startIndex = 1;
  }

  const cards: ParsedCard[] = [];
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue;
    const front = row[0].trim();
    const back = row.slice(1).join(", ").trim();
    if (front && back) {
      cards.push({ front, back });
    }
  }

  if (cards.length === 0) {
    throw new Error("有効なカードが見つかりません");
  }

  return cards;
}
