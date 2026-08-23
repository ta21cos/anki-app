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

test.describe("Settings - audio intervals", () => {
  test("shows defaults and persists a changed recall pause across reload", async ({
    page,
  }) => {
    await page.goto("/settings");

    await expect(
      page.getByRole("switch", { name: "自動読み上げ" }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("6 秒")).toBeVisible();
    await expect(page.getByText("3 秒")).toBeVisible();

    await page
      .getByRole("button", { name: "表面 → 裏面（想起ポーズ） を 1 秒長く" })
      .click();
    await expect(page.getByText("7 秒")).toBeVisible();

    await page.reload();
    await expect(page.getByText("7 秒")).toBeVisible();
    await expect(page.getByText("3 秒")).toBeVisible();
  });
});

test.describe("Settings - auto speak toggle", () => {
  test("turning auto speak off in settings is reflected on the study page and can be turned back on", async ({
    page,
  }) => {
    await importDeck(
      page,
      "autospeak.txt",
      "hello\tこんにちは\n",
      "読み上げ設定",
    );

    await page.goto("/settings");
    await page.getByRole("switch", { name: "自動読み上げ" }).click();
    await expect(
      page.getByRole("switch", { name: "自動読み上げ" }),
    ).toHaveAttribute("aria-checked", "false");

    await page.goto("/");
    await page.getByText("読み上げ設定").click();
    await expect(page.getByText("答えを見る")).toBeVisible();

    const toggle = page.getByRole("button", { name: "自動読み上げ オフ" });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(
      page.getByRole("button", { name: "自動読み上げ オン" }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.reload();
    await expect(
      page.getByRole("button", { name: "自動読み上げ オン" }),
    ).toBeVisible();
  });
});

const SILENT_MP3 = fs.readFileSync(
  path.resolve(process.cwd(), "worker", "silence-1s.mp3"),
);
const FRONT_KEY = "seg/test-front.mp3";
const BACK_KEY = "seg/test-back.mp3";

async function routeGeneratedAudio(page: import("@playwright/test").Page) {
  const requestedFiles: string[] = [];
  await page.route("**/api/audio/segments", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ keys: [FRONT_KEY, BACK_KEY] }),
    }),
  );
  await page.route("**/api/audio/file/**", (route) => {
    requestedFiles.push(new URL(route.request().url()).pathname);
    return route.fulfill({
      status: 200,
      contentType: "audio/mpeg",
      body: SILENT_MP3,
    });
  });
  return requestedFiles;
}

function stubSpeechSynthesis(page: import("@playwright/test").Page) {
  return page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
    window.speechSynthesis.speak = (utterance: SpeechSynthesisUtterance) => {
      spoken.push(utterance.text);
    };
    window.speechSynthesis.cancel = () => {};
  });
}

test.describe("Study - card audio", () => {
  test("plays the generated front audio, then the back audio when the answer is revealed", async ({
    page,
  }) => {
    const requestedFiles = await routeGeneratedAudio(page);

    await importDeck(page, "speak.txt", "apple\tりんご\n", "読み上げテスト");

    await page.goto("/");
    await page.getByText("読み上げテスト").click();
    await expect(
      page.getByRole("button", { name: "自動読み上げ オン" }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: "表面を再生" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "裏面を再生" })).toHaveCount(
      0,
    );
    await expect
      .poll(() => requestedFiles.some((p) => p.endsWith(FRONT_KEY)))
      .toBe(true);

    await page.getByText("答えを見る").click();
    await expect(page.getByText("Again")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "裏面を再生" }),
    ).toBeVisible();

    await expect
      .poll(() => requestedFiles.some((p) => p.endsWith(BACK_KEY)))
      .toBe(true);
  });

  test("replay buttons request the front and back audio again", async ({
    page,
  }) => {
    const requestedFiles = await routeGeneratedAudio(page);

    await importDeck(page, "replay.txt", "banana\tバナナ\n", "再生ボタン");

    await page.goto("/settings");
    await page.getByRole("switch", { name: "自動読み上げ" }).click();
    await expect(
      page.getByRole("switch", { name: "自動読み上げ" }),
    ).toHaveAttribute("aria-checked", "false");

    await page.goto("/");
    await page.getByText("再生ボタン").click();
    const frontButton = page.getByRole("button", { name: "表面を再生" });
    await expect(frontButton).toBeEnabled();
    expect(requestedFiles.filter((p) => p.endsWith(FRONT_KEY))).toHaveLength(0);

    await frontButton.click();
    await expect
      .poll(() => requestedFiles.filter((p) => p.endsWith(FRONT_KEY)).length)
      .toBe(1);

    await page.getByText("答えを見る").click();
    const backButton = page.getByRole("button", { name: "裏面を再生" });
    await expect(backButton).toBeEnabled();
    await backButton.click();
    await expect
      .poll(() => requestedFiles.filter((p) => p.endsWith(BACK_KEY)).length)
      .toBe(1);

    await frontButton.click();
    await expect
      .poll(() => requestedFiles.filter((p) => p.endsWith(FRONT_KEY)).length)
      .toBe(2);
  });

  test("falls back to Web Speech when the segment API fails", async ({
    page,
  }) => {
    await stubSpeechSynthesis(page);
    await page.route("**/api/audio/segments", (route) =>
      route.fulfill({ status: 500, body: "tts unavailable" }),
    );

    await importDeck(
      page,
      "fallback.txt",
      "cherry\tさくらんぼ\n",
      "退避テスト",
    );

    await page.goto("/");
    await page.getByText("退避テスト").click();
    await expect(
      page.getByRole("button", { name: "自動読み上げ オン" }),
    ).toBeVisible();

    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { __spoken: string[] }).__spoken,
        ),
      )
      .toContain("cherry");

    await page.getByText("答えを見る").click();
    await expect(page.getByText("Again")).toBeVisible();

    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { __spoken: string[] }).__spoken,
        ),
      )
      .toContain("さくらんぼ");
  });
});
