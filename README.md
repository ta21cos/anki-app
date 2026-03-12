# AnkiPWA

オフライン対応のスペースドリピティション（間隔反復）フラッシュカードアプリ。ブラウザだけで動作し、データはすべてローカル（IndexedDB）に保存されます。

**URL:** https://ta21cos-anki-app.vercel.app

## Features

- **FSRS アルゴリズム** — [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) による最新の間隔反復スケジューリング（Again / Hard / Good / Easy の4段階評価）
- **複数フォーマット対応** — `.txt`（タブ区切り）/ `.tsv` / `.csv` / `.apkg`（Anki形式）のインポート
- **HTML カード** — `<mark>`, `<b>`, `<i>` 等のHTMLタグに対応。ハイライトや書式付きカードが作成可能
- **PWA** — ホーム画面に追加してネイティブアプリのように使用可能。Service Worker によるオフライン対応
- **統計ダッシュボード** — 今日の復習数、復習待ち、カード状態（新規 / 学習中 / 復習）の可視化
- **デッキ管理** — 複数デッキの作成、デッキ間マージ機能
- **完全ローカル** — サーバーにデータを送信しません。すべてブラウザの IndexedDB に保存

## Tech Stack

| レイヤー | 技術 |
|---|---|
| Framework | [Next.js](https://nextjs.org/) 16 (App Router) |
| UI | [Tailwind CSS](https://tailwindcss.com/) v4 + [shadcn/ui](https://ui.shadcn.com/) |
| Font | [Zen Maru Gothic](https://fonts.google.com/specimen/Zen+Maru+Gothic) |
| DB | [Dexie.js](https://dexie.org/) v4 (IndexedDB wrapper) |
| SRS | [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) v4 |
| PWA | [Serwist](https://serwist.pages.dev/) 9 |
| .apkg Parser | [sql.js](https://sql.js.org/) + [JSZip](https://stuk.github.io/jszip/) |
| Sanitizer | [isomorphic-dompurify](https://github.com/kkomelin/isomorphic-dompurify) |
| CSV Parser | [PapaParse](https://www.papaparse.com/) |
| E2E Test | [Playwright](https://playwright.dev/) |
| Hosting | [Vercel](https://vercel.com/) |

## Getting Started

```bash
# Install dependencies
bun install

# Start dev server
bun dev

# Build for production
bun run build

# Run e2e tests
bunx playwright test
```

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
src/
  app/
    page.tsx          # デッキ一覧
    import/page.tsx   # ファイルインポート
    stats/page.tsx    # 統計ダッシュボード
    study/[deckId]/   # 学習セッション
  components/
    card-viewer.tsx   # カード表示（HTML描画）
    rating-buttons.tsx # FSRS 評価ボタン
    bottom-nav.tsx    # ナビゲーション
    deck-merge-dialog.tsx
  lib/
    db.ts             # Dexie スキーマ定義
    fsrs.ts           # ts-fsrs ラッパー
    importer/         # TXT/CSV/APKG パーサー
e2e/                  # Playwright テスト (35 specs)
```

## License

MIT
