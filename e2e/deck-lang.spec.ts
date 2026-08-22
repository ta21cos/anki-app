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

async function selectFile(
  page: import("@playwright/test").Page,
  fileName: string,
  content: string,
) {
  await page.goto("/import");
  const filePath = createTempFile(fileName, content);
  await page.locator('input[type="file"]').setInputFiles(filePath);
  return filePath;
}

test.describe("Deck languages - import", () => {
  test("defaults to English on both sides and shows 英→英 on the deck list", async ({
    page,
  }) => {
    const filePath = await selectFile(
      page,
      "default-lang.txt",
      "hello\tこんにちは\n",
    );

    await expect(page.locator("#import-lang-front")).toHaveValue("en");
    await expect(page.locator("#import-lang-back")).toHaveValue("en");

    await page.getByRole("button", { name: "インポート" }).click();
    await expect(page.getByText("インポート完了")).toBeVisible();
    fs.unlinkSync(filePath);

    await page.goto("/");
    await expect(page.getByText("default-lang")).toBeVisible();
    await expect(page.getByLabel("読み上げ言語 英→英")).toBeVisible();
  });

  test("imports a Japanese→English deck and shows 日→英 on the deck list", async ({
    page,
  }) => {
    const filePath = await selectFile(
      page,
      "ja-en.txt",
      "産休中の同僚の代わりを務めているんです。\tI'm covering for a colleague who's on maternity leave.\n",
    );

    await page.locator("#import-lang-front").selectOption("ja");
    await page.locator("#import-lang-back").selectOption("en");
    await page.getByRole("button", { name: "インポート" }).click();
    await expect(page.getByText("インポート完了")).toBeVisible();
    fs.unlinkSync(filePath);

    await page.goto("/");
    await expect(page.getByLabel("読み上げ言語 日→英")).toBeVisible();
  });
});

test.describe("Deck languages - edit", () => {
  test("changes the languages from the deck edit page and persists them", async ({
    page,
  }) => {
    const filePath = await selectFile(page, "edit-lang.txt", "apple\tりんご\n");
    await page.getByRole("button", { name: "インポート" }).click();
    await expect(page.getByText("インポート完了")).toBeVisible();
    fs.unlinkSync(filePath);

    await page.goto("/");
    await page.getByRole("button", { name: "デッキメニュー" }).click();
    await page.getByRole("button", { name: "編集" }).click();

    await expect(page.locator("#deck-edit-lang-front")).toHaveValue("en");
    await page.locator("#deck-edit-lang-back").selectOption("ja");
    await expect(page.locator("#deck-edit-lang-back")).toHaveValue("ja");

    await page.reload();
    await expect(page.locator("#deck-edit-lang-front")).toHaveValue("en");
    await expect(page.locator("#deck-edit-lang-back")).toHaveValue("ja");

    await page.goto("/");
    await expect(page.getByLabel("読み上げ言語 英→日")).toBeVisible();
  });
});

test.describe("Audio quiz - interval summary", () => {
  test("shows the configured intervals only for the audio quiz mode", async ({
    page,
  }) => {
    const filePath = await selectFile(page, "pause.txt", "hello\tこんにちは\n");
    await page.getByRole("button", { name: "インポート" }).click();
    await expect(page.getByText("インポート完了")).toBeVisible();
    fs.unlinkSync(filePath);

    await page.goto("/session");
    await expect(page.getByText("想起ポーズ")).toHaveCount(0);

    await page.getByRole("button", { name: "音声クイズ" }).click();
    await expect(page.getByText("想起ポーズ 6 秒")).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("link", { name: "設定" }),
    ).toHaveAttribute("href", "/settings");
  });
});
