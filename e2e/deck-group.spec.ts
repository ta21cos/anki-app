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

async function importTwoGroupedDecks(page: import("@playwright/test").Page) {
  await importDeck(page, "g1.txt", "a\t1\nb\t2\n", "文章::L01 現在形");
  await importDeck(page, "g2.txt", "c\t3\n", "文章::L02 疑問文");
}

test.describe("Deck groups - deck list", () => {
  test("collapses decks sharing a name prefix into one group row", async ({
    page,
  }) => {
    await importTwoGroupedDecks(page);

    await page.goto("/");
    await expect(page.getByText("文章", { exact: true })).toBeVisible();
    await expect(page.getByText("2 デッキ / 3 枚")).toBeVisible();

    // 折りたたみ中は子デッキが出ない
    await expect(page.getByText("L01 現在形")).toHaveCount(0);

    await page.getByRole("button", { expanded: false }).first().click();
    await expect(page.getByText("L01 現在形")).toBeVisible();
    await expect(page.getByText("L02 疑問文")).toBeVisible();
  });

  test("keeps decks without a separator at the top level", async ({ page }) => {
    await importDeck(page, "flat.txt", "x\ty\n", "区切りなしデッキ");

    await page.goto("/");
    await expect(page.getByText("区切りなしデッキ")).toBeVisible();
    // グループ行（開閉ボタン）が作られないこと
    await expect(page.getByRole("button", { expanded: false })).toHaveCount(0);
  });

  test("group checkbox turns every child deck off at once", async ({
    page,
  }) => {
    await importTwoGroupedDecks(page);

    await page.goto("/");
    const groupCheckbox = page.getByLabel("「文章」のデッキをすべて選択");
    await expect(groupCheckbox).toBeChecked();

    await groupCheckbox.uncheck();
    await expect(groupCheckbox).not.toBeChecked();

    await page.reload();
    await expect(
      page.getByLabel("「文章」のデッキをすべて選択"),
    ).not.toBeChecked();
  });
});

test.describe("Deck groups - session launcher", () => {
  test("shows one row per group and expands to individual decks", async ({
    page,
  }) => {
    await importTwoGroupedDecks(page);

    await page.goto("/session");
    await expect(page.getByText("2 デッキ")).toBeVisible();
    await expect(page.getByText("L01 現在形")).toHaveCount(0);

    await page.getByRole("button", { expanded: false }).first().click();
    await expect(page.getByText("L01 現在形")).toBeVisible();
    await expect(page.getByText("L02 疑問文")).toBeVisible();
  });

  test("deselecting the group excludes all its cards from the session", async ({
    page,
  }) => {
    await importTwoGroupedDecks(page);

    await page.goto("/session");
    await expect(page.getByText("/ 3 枚")).toBeVisible();

    await page.getByLabel("「文章」のデッキをすべて選択").uncheck();
    await expect(page.getByText("復習するカードがありません")).toBeVisible();
  });
});
