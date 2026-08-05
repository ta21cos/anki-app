# AnkiPWA

スペースドリピティション（間隔反復）フラッシュカードアプリ。Cloudflare Workers 上で動作し、データは Turso に保存されます。アクセスは Cloudflare Access で保護されます。

## Features

- **FSRS アルゴリズム** — [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) による最新の間隔反復スケジューリング（Again / Hard / Good / Easy の4段階評価）
- **複数フォーマット対応** — `.txt`（タブ区切り）/ `.tsv` / `.csv` / `.apkg`（Anki形式）のインポート
- **HTML カード** — `<mark>`, `<b>`, `<i>` 等のHTMLタグに対応。ハイライトや書式付きカードが作成可能
- **統計ダッシュボード** — 今日の復習数、復習待ち、カード状態（新規 / 学習中 / 復習）の可視化
- **デッキ管理** — 複数デッキの作成、デッキ間マージ機能
- **マルチデバイス** — Cloudflare Access でログインすれば、どの端末からも同じデータにアクセス可能

## Tech Stack

| レイヤー | 技術 |
|---|---|
| SPA | [Vite](https://vite.dev/) + React 19 + [TanStack Router](https://tanstack.com/router) |
| API | [Hono](https://hono.dev/) on [Cloudflare Workers](https://workers.cloudflare.com/) |
| 認証 | [Cloudflare Access](https://www.cloudflare.com/zero-trust/products/access/)（[@hono/cloudflare-access](https://www.npmjs.com/package/@hono/cloudflare-access) で JWT 検証） |
| UI | [Tailwind CSS](https://tailwindcss.com/) v4 + [shadcn/ui](https://ui.shadcn.com/) |
| Font | [Zen Maru Gothic](https://fonts.google.com/specimen/Zen+Maru+Gothic)（Google Fonts CDN） |
| DB | [Turso](https://turso.tech/) (libSQL) + [Drizzle ORM](https://orm.drizzle.team/) |
| SRS | [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) v4 |
| .apkg Parser | [sql.js](https://sql.js.org/) + [JSZip](https://stuk.github.io/jszip/) |
| Sanitizer | [isomorphic-dompurify](https://github.com/kkomelin/isomorphic-dompurify) |
| CSV Parser | [PapaParse](https://www.papaparse.com/) |
| E2E Test | [Playwright](https://playwright.dev/) |
| Hosting | Cloudflare Workers（静的アセット + API を 1 Worker で配信） |

## Getting Started

```bash
# Install dependencies
bun install

# ローカル API 用の環境変数を用意する
cp .dev.vars.example .dev.vars  # 値を埋める

# Start dev servers（2 プロセス）
bun run dev:api  # wrangler dev (port 8787)
bun dev          # vite dev server（/api を 8787 に proxy）

# Build for production
bun run build

# Deploy
bun run deploy

# Run e2e tests
bunx playwright test
```

## Deployment Setup

初回デプロイ時に 1 度だけ行う設定:

1. `wrangler secret put TURSO_DATABASE_URL` と `wrangler secret put TURSO_AUTH_TOKEN` で DB 接続情報を登録する
2. `wrangler.jsonc` の `CF_ACCESS_TEAM` に Zero Trust の team 名（`<team>.cloudflareaccess.com` の `<team>`）を設定する
3. Cloudflare ダッシュボードで Worker の **Settings > Domains & Routes** から workers.dev URL に対して **Enable Cloudflare Access** を実行し、ポリシーに許可するメールアドレスを設定する
4. 既存データがある場合は `bun scripts/migrate-to-owner.ts <email>` で `device_id` を `owner_id`（Access のログインメールアドレス）に移行する

## Import Format

### TXT / TSV（タブ区切り）

```
front text	back text
question	answer
```

### CSV（カンマ区切り）

```csv
front,back
question,answer
```

ヘッダー行は自動検出されます。

### HTML 対応

カードにHTMLタグを含めることができます:

```
He <mark>go</mark> to school.	He <mark>goes</mark> to school.
<b>Important</b> term	Definition here
```

### APKG

Anki のエクスポートファイル（`.apkg`）をそのままインポートできます。

## Project Structure

```
worker/
  index.ts            # Hono API（全エンドポイント + Access JWT 検証）
  schema.ts           # Drizzle スキーマ（decks / cards）
  db.ts               # Turso クライアント生成
src/
  main.tsx            # SPA エントリ
  router.tsx          # TanStack Router ルート定義
  pages/
    home.tsx          # デッキ一覧
    daily.tsx         # 今日の学習
    import.tsx        # ファイルインポート
    stats.tsx         # 統計ダッシュボード
    study.tsx         # 学習セッション
    listen.tsx        # 読み上げモード
    deck-edit.tsx     # デッキ編集
  components/
    card-viewer.tsx   # カード表示（HTML描画）
    rating-buttons.tsx # FSRS 評価ボタン
    bottom-nav.tsx    # ナビゲーション
    deck-merge-dialog.tsx
  lib/
    fsrs.ts           # ts-fsrs ラッパー
    api/              # fetch クライアント + SWR hooks
    importer/         # TXT/CSV/APKG パーサー
e2e/                  # Playwright テスト
scripts/
  migrate-to-owner.ts # device_id → owner_id 移行（1 回だけ実行）
  import-tsv.ts       # TSV/CSV を DB に直接インポート
```

## License

MIT
