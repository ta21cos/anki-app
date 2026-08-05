import { test as base } from "@playwright/test";

// テストごとにランダムな owner を割り当てて、Turso 上のデータを分離する。
// 旧実装ではブラウザ context ごとに localStorage の device token が
// 新規発行されることで同じ分離が成立していた。X-Dev-Owner ヘッダーは
// worker が DEV_OWNER_ID 設定時（ローカル / e2e）のみ解釈する。
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.setExtraHTTPHeaders({
      "X-Dev-Owner": `e2e-${crypto.randomUUID()}`,
    });
    await use(context);
  },
});

export { expect } from "@playwright/test";
