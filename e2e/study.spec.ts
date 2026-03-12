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

test.describe("Study - Deck with due cards", () => {
  test("shows study page with card front and answer button", async ({
    page,
  }) => {
    await importDeck(
      page,
      "study.txt",
      "hello\tこんにちは\nworld\t世界\n",
      "学習テスト",
    );

    await page.goto("/");
    await page.getByText("学習テスト").click();

    await expect(page.getByText("学習テスト")).toBeVisible();
    await expect(page.getByText("残り")).toBeVisible();
    await expect(page.getByText("答えを見る")).toBeVisible();
  });

  test("reveals answer and shows rating buttons on click", async ({ page }) => {
    await importDeck(page, "study2.txt", "apple\tりんご\n", "回答テスト");

    await page.goto("/");
    await page.getByText("回答テスト").click();

    await page.getByText("答えを見る").click();

    await expect(page.getByText("Again")).toBeVisible();
    await expect(page.getByText("Hard")).toBeVisible();
    await expect(page.getByText("Good")).toBeVisible();
    await expect(page.getByText("Easy")).toBeVisible();
  });

  test("rates card and progresses to next or completion", async ({ page }) => {
    await importDeck(page, "study3.txt", "q1\ta1\n", "進行テスト");

    await page.goto("/");
    await page.getByText("進行テスト").click();

    await page.getByText("答えを見る").click();
    await page.getByText("Easy").click();

    await expect(page.getByText("学習完了")).toBeVisible();
  });
});

test.describe("Study - Card answer and grading", () => {
  test("shows back content after clicking answer button", async ({ page }) => {
    await importDeck(
      page,
      "back.txt",
      "表面テキスト\t裏面テキスト\n",
      "裏面テスト",
    );

    await page.goto("/");
    await page.getByText("裏面テスト").click();

    await expect(page.getByText("表面テキスト")).toBeVisible();

    await page.getByText("答えを見る").click();

    await expect(page.getByRole("button", { name: /Again/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Good/ })).toBeVisible();
  });

  test("Again schedules card for later review", async ({ page }) => {
    await importDeck(page, "again.txt", "問題A\t回答A\n", "Againテスト");

    await page.goto("/");
    await page.getByText("Againテスト").click();

    await page.getByText("答えを見る").click();
    await page.getByRole("button", { name: /Again/ }).click();

    await expect(page.getByText("学習完了")).toBeVisible();
  });

  test("Hard completes a single card deck", async ({ page }) => {
    await importDeck(page, "hard.txt", "問題H\t回答H\n", "Hardテスト");

    await page.goto("/");
    await page.getByText("Hardテスト").click();

    await page.getByText("答えを見る").click();
    await page.getByRole("button", { name: /Hard/ }).click();

    await expect(page.getByText("学習完了")).toBeVisible();
  });

  test("Good completes a single card deck", async ({ page }) => {
    await importDeck(page, "good.txt", "問題G\t回答G\n", "Goodテスト");

    await page.goto("/");
    await page.getByText("Goodテスト").click();

    await page.getByText("答えを見る").click();
    await page.getByRole("button", { name: /Good/ }).click();

    await expect(page.getByText("学習完了")).toBeVisible();
  });

  test("Easy completes a single card deck", async ({ page }) => {
    await importDeck(page, "easy.txt", "問題E\t回答E\n", "Easyテスト");

    await page.goto("/");
    await page.getByText("Easyテスト").click();

    await page.getByText("答えを見る").click();
    await page.getByRole("button", { name: /Easy/ }).click();

    await expect(page.getByText("学習完了")).toBeVisible();
  });

  test("reviews multiple cards in sequence", async ({ page }) => {
    await importDeck(
      page,
      "multi.txt",
      "card1\tanswer1\ncard2\tanswer2\ncard3\tanswer3\n",
      "連続テスト",
    );

    await page.goto("/");
    await page.getByText("連続テスト").click();

    await expect(page.getByText("残り 3 枚")).toBeVisible();

    await page.getByText("答えを見る").click();
    await page.getByRole("button", { name: /Easy/ }).click();
    await expect(page.getByText("残り 2 枚")).toBeVisible();

    await page.getByText("答えを見る").click();
    await page.getByRole("button", { name: /Good/ }).click();
    await expect(page.getByText("残り 1 枚")).toBeVisible();

    await page.getByText("答えを見る").click();
    await page.getByRole("button", { name: /Hard/ }).click();

    await expect(page.getByText("学習完了")).toBeVisible();
  });
});

test.describe("Study - HTML rendering", () => {
  test("renders mark tag as highlighted text", async ({ page }) => {
    await importDeck(
      page,
      "html-mark.txt",
      "He <mark>go</mark> to school.\tHe <mark>goes</mark> to school.\n",
      "HTMLマークテスト",
    );

    await page.goto("/");
    await page.getByText("HTMLマークテスト").click();

    const markFront = page.locator("mark");
    await expect(markFront).toBeVisible();
    await expect(markFront).toHaveText("go");

    await page.getByText("答えを見る").click();

    const marks = page.locator("mark");
    await expect(marks).toHaveCount(2);
    await expect(marks.nth(1)).toHaveText("goes");
  });

  test("renders bold and italic HTML tags", async ({ page }) => {
    await importDeck(
      page,
      "html-format.txt",
      "<b>bold</b> and <i>italic</i>\tformatted answer\n",
      "HTML書式テスト",
    );

    await page.goto("/");
    await page.getByText("HTML書式テスト").click();

    await expect(page.locator("b")).toHaveText("bold");
    await expect(page.locator("i")).toHaveText("italic");
  });

  test("strips dangerous script tags", async ({ page }) => {
    await importDeck(
      page,
      "html-xss.txt",
      '<script>alert("xss")</script>safe text\tclean answer\n',
      "XSSテスト",
    );

    await page.goto("/");
    await page.getByText("XSSテスト").click();

    await expect(page.getByText("safe text")).toBeVisible();
    const card = page.locator("[class*='rounded-xl']");
    await expect(card.locator("script")).toHaveCount(0);
  });
});

test.describe("Study - Deck list due count", () => {
  test("shows due count badge on deck list", async ({ page }) => {
    await importDeck(page, "due.txt", "a\tb\nc\td\n", "バッジテスト");

    await page.goto("/");

    const badge = page.locator("span.rounded-full.bg-primary");
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("2");
  });
});

test.describe("Study - No deck found", () => {
  test("shows error when deck does not exist", async ({ page }) => {
    await page.goto("/study/nonexistent-id");
    await expect(page.getByText("デッキが見つかりません")).toBeVisible();
  });
});
