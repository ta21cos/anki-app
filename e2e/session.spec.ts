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

async function setLimitToMinimum(page: import("@playwright/test").Page) {
  const minus = page.getByRole("button", { name: "学習枚数を減らす" });
  while (await minus.isEnabled()) {
    await minus.click();
  }
}

async function rateAllCards(
  page: import("@playwright/test").Page,
  count: number,
) {
  for (const index of Array.from({ length: count }).keys()) {
    await expect(page.getByText(`残り ${count - index} 枚`)).toBeVisible();
    await page.getByText("答えを見る").click();
    await page.getByRole("button", { name: /Easy/ }).click();
  }
}

test.describe("Study session - repeatable within a day", () => {
  test("borrows upcoming cards after every due card is rated", async ({
    page,
  }) => {
    await importDeck(page, "repeat.txt", "a\t1\nb\t2\nc\t3\n", "繰り返し");

    await page.goto("/session");
    await expect(page.getByText("期限切れ 3 枚")).toBeVisible();
    await setLimitToMinimum(page);
    await expect(page.getByText("/ 3 枚")).toBeVisible();

    await page.getByRole("button", { name: "学習を始める" }).click();
    await expect(page.getByText("残り 3 枚")).toBeVisible();
    await rateAllCards(page, 3);
    await expect(page.getByText("学習完了！")).toBeVisible();

    await page.getByText("スタートに戻る").click();
    await expect(page.getByText("期限切れ 0 枚")).toBeVisible();
    await expect(
      page.getByText("期限前のカード 3 枚を先取りします"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "学習を始める" }),
    ).toBeEnabled();

    await page.getByRole("button", { name: "学習を始める" }).click();
    await expect(page.getByText("残り 3 枚")).toBeVisible();
  });

  test("shows the empty message when borrowing is off and nothing is due", async ({
    page,
  }) => {
    await importDeck(page, "noborrow.txt", "x\ty\n", "先取りなし");

    await page.goto("/session");
    await page.getByRole("button", { name: "学習を始める" }).click();
    await rateAllCards(page, 1);
    await expect(page.getByText("学習完了！")).toBeVisible();
    await page.getByText("スタートに戻る").click();

    await page.getByLabel("期限前のカードも先取りする").uncheck();
    await expect(page.getByText("復習するカードがありません")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "学習を始める" }),
    ).toBeDisabled();
  });

  test("redirects /daily to /session", async ({ page }) => {
    await page.goto("/daily");
    await expect(page).toHaveURL(/\/session$/);
    await expect(page.getByRole("heading", { name: "学習" })).toBeVisible();
  });
});
