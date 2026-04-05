---
name: import-to-turso
description: TSV/CSV ファイルを Turso DB に直接インポートする。ファイルパスを受け取り、既存のデバイス ID を使ってカードを挿入する。
user_invocable: true
---

# Import to Turso

TSV/CSV ファイルを anki-app の Turso DB に直接インポートするスキル。

## 使い方

```
/import-to-turso <file-path> [deck-name]
```

## 実行手順

1. `.env.local` から接続情報を読み込む
2. 以下のコマンドを実行する:

```bash
source .env.local && bun scripts/import-tsv.ts <file-path> [deck-name]
```

- `<file-path>`: インポートする TSV/CSV ファイルのパス
- `[deck-name]`: デッキ名（省略時はファイル名を使用）
- 既存のデバイス ID が1つなら自動使用、複数なら選択プロンプトが出る
- TSV 形式: タブ区切り、1列目=front（誤用）、2列目=back（正しい表現）

## ファイルの場所

- スクリプト: `scripts/import-tsv.ts`
- 環境変数: `.env.local` (TURSO_DATABASE_URL, TURSO_AUTH_TOKEN)
