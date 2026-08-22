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

async function importSingleCardDeck(
  page: import("@playwright/test").Page,
  deckName: string,
) {
  await page.goto("/import");
  const filePath = createTempFile("schedule.txt", "問題S\t回答S\n");
  await page.locator('input[type="file"]').setInputFiles(filePath);
  const deckInput = page.locator("#deck-name");
  await deckInput.clear();
  await deckInput.fill(deckName);
  await page.getByRole("button", { name: "インポート" }).click();
  await expect(page.getByText("インポート完了")).toBeVisible();
  fs.unlinkSync(filePath);
}

test.describe("Scheduling - day based intervals", () => {
  test("rating buttons show 5min for Hard and whole days for Good / Easy", async ({
    page,
  }) => {
    await importSingleCardDeck(page, "日単位テスト");

    await page.goto("/");
    await page.getByText("日単位テスト").click();
    await page.getByText("答えを見る").click();

    await expect(page.getByRole("button", { name: /Hard/ })).toContainText(
      "5分",
    );
    await expect(page.getByRole("button", { name: /Good/ })).toContainText(
      "1日",
    );
    const easyText = await page
      .getByRole("button", { name: /Easy/ })
      .innerText();
    const easyDays = Number(easyText.match(/(\d+)日/)?.[1]);
    expect(easyDays).toBeGreaterThanOrEqual(2);
  });

  test("Good schedules the card for tomorrow or later", async ({ page }) => {
    await importSingleCardDeck(page, "翌日テスト");

    await page.goto("/");
    await page.getByText("翌日テスト").click();
    const deckId = page.url().split("/study/")[1];

    await page.getByText("答えを見る").click();
    await page.getByRole("button", { name: /Good/ }).click();
    await expect(page.getByText("学習完了")).toBeVisible();

    const response = await page.request.get(`/api/decks/${deckId}/cards`);
    const [card] = (await response.json()) as { due: number; state: number }[];
    const tomorrowMidnight = new Date();
    tomorrowMidnight.setHours(24, 0, 0, 0);
    expect(card.due).toBeGreaterThanOrEqual(tomorrowMidnight.getTime());
    expect(card.state).toBe(2);
  });
});
