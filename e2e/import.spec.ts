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

test.describe("Import - Page UI", () => {
  test("shows import page with drag & drop zone", async ({ page }) => {
    await page.goto("/import");
    await expect(page.getByText("ファイルをドラッグ＆ドロップ")).toBeVisible();
    await expect(page.getByText(".txt / .tsv / .csv / .apkg に対応")).toBeVisible();
    await expect(page.getByText("ファイルを選択")).toBeVisible();
  });

  test("highlights import nav item as active", async ({ page }) => {
    await page.goto("/import");
    const importLink = page.getByRole("link", { name: "インポート" });
    await expect(importLink).toHaveClass(/text-primary/);
  });
});

test.describe("Import - TXT file", () => {
  test("imports a tab-separated TXT file", async ({ page }) => {
    await page.goto("/import");

    const filePath = createTempFile(
      "test-cards.txt",
      "apple\tりんご\ndog\t犬\ncat\t猫\n",
    );

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    await expect(page.getByText("test-cards.txt")).toBeVisible();
    await expect(page.locator("#deck-name")).toHaveValue("test-cards");

    await page.getByRole("button", { name: "インポート" }).click();

    await expect(page.getByText("インポート完了")).toBeVisible();
    await expect(page.getByText("3")).toBeVisible();

    fs.unlinkSync(filePath);
  });
});

test.describe("Import - CSV file", () => {
  test("imports a CSV file with header", async ({ page }) => {
    await page.goto("/import");

    const filePath = createTempFile(
      "test-cards.csv",
      "front,back\nhello,こんにちは\ngoodbye,さようなら\n",
    );

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    await expect(page.getByText("test-cards.csv")).toBeVisible();

    await page.getByRole("button", { name: "インポート" }).click();

    await expect(page.getByText("インポート完了")).toBeVisible();
    await expect(page.getByText("2")).toBeVisible();

    fs.unlinkSync(filePath);
  });
});

test.describe("Import - Deck creation", () => {
  test("creates deck and shows it on home page", async ({ page }) => {
    await page.goto("/import");

    const filePath = createTempFile(
      "my-deck.txt",
      "word1\tmeaning1\nword2\tmeaning2\n",
    );

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    const deckNameInput = page.locator("#deck-name");
    await deckNameInput.clear();
    await deckNameInput.fill("テストデッキ");

    await page.getByRole("button", { name: "インポート" }).click();
    await expect(page.getByText("インポート完了")).toBeVisible();

    await page.getByRole("link", { name: "デッキ" }).click();
    await expect(page.getByText("テストデッキ")).toBeVisible();

    fs.unlinkSync(filePath);
  });

  test("auto-fills deck name from filename", async ({ page }) => {
    await page.goto("/import");

    const filePath = createTempFile("英単語リスト.txt", "test\tテスト\n");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    await expect(page.locator("#deck-name")).toHaveValue("英単語リスト");

    fs.unlinkSync(filePath);
  });
});

test.describe("Import - Validation", () => {
  test("disables import button when deck name is empty", async ({ page }) => {
    await page.goto("/import");

    const filePath = createTempFile("test.txt", "a\tb\n");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    const deckNameInput = page.locator("#deck-name");
    await deckNameInput.clear();

    const importButton = page.getByRole("button", { name: "インポート" });
    await expect(importButton).toBeDisabled();

    fs.unlinkSync(filePath);
  });
});
