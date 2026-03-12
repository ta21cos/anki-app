import JSZip from "jszip";
import { sanitizeHtml } from "@/lib/sanitize";
import type { ParsedCard } from "./txt";

export async function parseApkg(buffer: ArrayBuffer): Promise<ParsedCard[]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error("不正なファイル形式です。.apkg ファイルを確認してください");
  }

  const dbFile = zip.file("collection.anki21") ?? zip.file("collection.anki2");
  if (!dbFile) {
    throw new Error(
      ".apkg 内にデータベースが見つかりません (collection.anki21/anki2)",
    );
  }

  const dbBuffer = await dbFile.async("arraybuffer");

  const initSqlJs = (await import("sql.js")).default;
  const SQL = await initSqlJs({
    locateFile: () => "/sql-wasm.wasm",
  });

  const db = new SQL.Database(new Uint8Array(dbBuffer));

  try {
    const results = db.exec("SELECT flds FROM notes");
    if (results.length === 0 || results[0].values.length === 0) {
      throw new Error(".apkg にカードが含まれていません");
    }

    const cards: ParsedCard[] = [];
    for (const row of results[0].values) {
      const flds = String(row[0]);
      const fields = flds.split("\x1f");
      if (fields.length < 1 || !fields[0].trim()) continue;

      const front = sanitizeHtml(fields[0]);
      const back =
        fields.length >= 2 ? sanitizeHtml(fields.slice(1).join("<br>")) : "";

      if (front) {
        cards.push({ front, back });
      }
    }

    if (cards.length === 0) {
      throw new Error("有効なカードが見つかりません");
    }

    return cards;
  } finally {
    db.close();
  }
}
