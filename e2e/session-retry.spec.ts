import { test, expect } from "./fixtures";
import path from "path";
import fs from "fs";
import os from "os";

function createTempFile(name: string, content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anki-e2e-"));
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content);
  return filePath;
}

async function importDeck(
  page: import("@playwright/test").Page,
  fileName: string,
  content: string,
  deckName: string,
) {
  await page.goto("/import");
  const filePath = createTempFile(fileName, content);
  await page.locator('input[type="file"]').setInputFiles(filePath);
  const deckInput = page.locator("#deck-name");
  await deckInput.clear();
  await deckInput.fill(deckName);
  await page.getByRole("button", { name: "インポート" }).click();
  await expect(page.getByText("インポート完了")).toBeVisible();
  fs.unlinkSync(filePath);
}

async function rateAllCardsGood(
  page: import("@playwright/test").Page,
  count: number,
) {
  for (const index of Array.from({ length: count }).keys()) {
    await expect(page.getByText(`残り ${count - index} 枚`)).toBeVisible();
    await page.getByText("答えを見る").click();
    await page.getByRole("button", { name: /Good/ }).click();
  }
}

test.describe("Study session - retry with the same cards", () => {
  test("restarts the finished session with the same cards in the same order", async ({
    page,
  }) => {
    await importDeck(
      page,
      "retry.txt",
      "retry-front-1\tback-1\nretry-front-2\tback-2\n",
      "リトライ",
    );

    await page.goto("/session");
    await page.getByRole("button", { name: "学習を始める" }).click();
    await expect(page.getByText("retry-front-1")).toBeVisible();
    await rateAllCardsGood(page, 2);
    await expect(page.getByText("学習完了！")).toBeVisible();

    const retryButton = page.getByRole("button", {
      name: "同じカードでもう一度",
    });
    await expect(retryButton).toBeVisible();
    await retryButton.click();

    await expect(page.getByText("残り 2 枚")).toBeVisible();
    await expect(page.getByText("retry-front-1")).toBeVisible();
    await rateAllCardsGood(page, 2);
    await expect(page.getByText("学習完了！")).toBeVisible();
    await expect(page.getByText("2 枚のカードを復習しました")).toBeVisible();
  });
});
