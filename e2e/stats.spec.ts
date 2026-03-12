import { test, expect } from "@playwright/test";
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
  deckName?: string,
) {
  await page.goto("/import");
  const filePath = createTempFile(fileName, content);
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);
  if (deckName) {
    const deckInput = page.locator("#deck-name");
    await deckInput.clear();
    await deckInput.fill(deckName);
  }
  await page.getByRole("button", { name: "インポート" }).click();
  await expect(page.getByText("インポート完了")).toBeVisible();
  fs.unlinkSync(filePath);
}

test.describe("Stats Page", () => {
  test("shows stats page with card counts", async ({ page }) => {
    await page.goto("/stats");
    await expect(page.getByRole("heading", { name: "統計" })).toBeVisible();
    await expect(page.getByText("今日の復習")).toBeVisible();
    await expect(page.getByText("復習待ち")).toBeVisible();
    await expect(page.getByText("総カード数")).toBeVisible();
    await expect(page.getByText("デッキ数")).toBeVisible();
  });

  test("highlights stats nav item as active", async ({ page }) => {
    await page.goto("/stats");
    const statsLink = page.getByRole("link", { name: "統計" });
    await expect(statsLink).toHaveClass(/text-primary/);
  });

  test("shows card state bars", async ({ page }) => {
    await page.goto("/stats");
    await expect(
      page.getByRole("heading", { name: "カードの状態" }),
    ).toBeVisible();
    await expect(page.getByText("新規")).toBeVisible();
    await expect(page.getByText("学習中")).toBeVisible();
  });

  test("shows updated counts after import", async ({ page }) => {
    await importDeck(page, "stats.txt", "a\tb\nc\td\ne\tf\n", "統計テスト");
    await page.goto("/stats");
    const totalCard = page
      .getByText("総カード数")
      .locator("..")
      .locator("..")
      .getByText("3");
    await expect(totalCard).toBeVisible();
  });
});

test.describe("Deck Merge", () => {
  test("shows merge button when 2+ decks exist", async ({ page }) => {
    await importDeck(page, "merge1.txt", "a\tb\n", "デッキA");
    await importDeck(page, "merge2.txt", "c\td\n", "デッキB");

    await page.goto("/");
    await expect(page.getByText("デッキをマージ")).toBeVisible();
  });

  test("does not show merge button with only one deck", async ({ page }) => {
    await importDeck(page, "single.txt", "a\tb\n", "単一デッキ");

    await page.goto("/");
    await expect(page.getByText("デッキをマージ")).not.toBeVisible();
  });

  test("merges two decks into one", async ({ page }) => {
    await importDeck(page, "mergeA.txt", "x\ty\n", "マージ先デッキ");
    await importDeck(page, "mergeB.txt", "p\tq\nr\ts\n", "マージ元デッキ");

    await page.goto("/");
    await page.getByText("デッキをマージ").click();

    await page.getByRole("radio", { name: "マージ先デッキ" }).click();
    await page.getByRole("checkbox", { name: "マージ元デッキ" }).click();

    await page.getByText("マージ実行").click();

    await expect(page.getByText("3 枚")).toBeVisible();
    await expect(page.getByText("マージ元デッキ")).not.toBeVisible();
  });
});
