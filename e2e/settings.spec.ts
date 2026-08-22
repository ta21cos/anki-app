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

test.describe("Study - auto speak", () => {
  test("speaks the back text when the answer is revealed", async ({ page }) => {
    await page.addInitScript(() => {
      const spoken: string[] = [];
      (window as unknown as { __spoken: string[] }).__spoken = spoken;
      window.speechSynthesis.speak = (utterance: SpeechSynthesisUtterance) => {
        spoken.push(utterance.text);
      };
      window.speechSynthesis.cancel = () => {};
    });

    await importDeck(page, "speak.txt", "apple\tりんご\n", "読み上げテスト");

    await page.goto("/");
    await page.getByText("読み上げテスト").click();
    await expect(
      page.getByRole("button", { name: "自動読み上げ オン" }),
    ).toBeVisible();

    await page.getByText("答えを見る").click();
    await expect(page.getByText("Again")).toBeVisible();

    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { __spoken: string[] }).__spoken,
        ),
      )
      .toContain("りんご");
  });
});
