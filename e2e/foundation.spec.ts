import { test, expect } from "@playwright/test";

test.describe("Foundation - Deck List Page", () => {
  test("shows empty state when no decks exist", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("デッキがありません")).toBeVisible();
    await expect(
      page.getByText("インポートタブからカードを追加しましょう"),
    ).toBeVisible();
  });

  test("has correct page title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("AnkiPWA");
  });
});

test.describe("Foundation - Bottom Navigation", () => {
  test("renders all three nav items", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "デッキ" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "インポート" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "統計" })).toBeVisible();
  });

  test("highlights active nav item on home page", async ({ page }) => {
    await page.goto("/");
    const deckLink = page.getByRole("link", { name: "デッキ" });
    await expect(deckLink).toHaveClass(/text-primary/);
    const importLink = page.getByRole("link", { name: "インポート" });
    await expect(importLink).toHaveClass(/text-muted-foreground/);
  });
});

test.describe("Foundation - PWA Manifest", () => {
  test("serves manifest with correct app name", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);
    const manifest = await response.json();
    expect(manifest.name).toBe("AnkiPWA");
    expect(manifest.short_name).toBe("AnkiPWA");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons).toHaveLength(2);
  });
});

test.describe("Foundation - PWA Meta Tags", () => {
  test("has apple-web-app meta tags", async ({ page }) => {
    await page.goto("/");
    const appleTouchIcon = page.locator('link[rel="apple-touch-icon"]');
    await expect(appleTouchIcon).toHaveAttribute("href", "/icon-192.png");
  });

  test("has viewport meta for mobile", async ({ page }) => {
    await page.goto("/");
    const viewport = page.locator('meta[name="viewport"]');
    const content = await viewport.getAttribute("content");
    expect(content).toContain("width=device-width");
  });
});
