---
name: generate-ja-en-cards
description: Google Drive 上の English Scrum 教材（文法レッスン / Vocabulary Reading Series）から、日本語 → 英語の「文章」「chunk」カードを生成し、TSV 経由で Turso のデッキに追加する。新しいレッスンや週次の Reading Series が届いたときに使う。
user_invocable: true
---

# Generate JA→EN cards

English Scrum の Google ドキュメントから瞬間英作文用カードを生成し、既存デッキ「文章（English Scrum）」「チャンク（English Scrum）」に追加するスキル。

## 使い方

```
/generate-ja-en-cards <Google Drive の file ID または URL> [...]
```

## 実行手順

1. `mcp__claude_ai_Google_Drive__read_file_content` でドキュメントを読む（未認証なら `/mcp` で「claude.ai Google Drive」を認証してもらう）。
2. 下記「カード生成ガイド」に従い、教材 1 本につき subagent 1 つで `<slug>.sentences.tsv` / `<slug>.chunks.tsv` / `<slug>.vocab.txt` を `.claude-works/<branch-slug>/generated/` に生成する。Reading Series の場合は、既出語彙の一覧（`lesson-*.vocab.txt` の和集合）を渡し、未出語彙を優先させる。
3. 機械検証する: 1 行 1 タブ、両側非空、HTML なし、表面に日本語を含む、裏面に日本語を含まない、chunk は 3 語以上、ファイル横断で英語裏面の重複なし。
4. 目視でざっと確認し、文法解説の見出し（"to talk about general ability" のようなメタ記述）が混ざっていれば削る。
5. `scripts/import-tsv.ts` で Turso に投入する。**教材 1 本につき文章とチャンクのデッキを 1 つずつ作る**（1 デッキ 20〜30 枚。1 セッションぶんに相当する）。まとめて 1 つの大きなデッキにはしない。

デッキ名は Anki と同じ `親::子` 記法で `<種別>::<コード> <短い主題>` の形にする。アプリは `::` の前をグループとして折りたたんで表示するため、この形にすると文章とチャンクがそれぞれ 1 行にまとまる。種別は `文章` / `チャンク`、コードは文法レッスンなら `L01`〜、Vocabulary Reading Series なら週番号で `R31`〜とする。主題は日本語で短く書く（例: `文章::L07 受動態`、`チャンク::R32 語彙リーディング`）。

```bash
source .env.local && bun scripts/import-tsv.ts lesson-12.sentences.tsv "文章::L12 間接話法" --front-lang ja --back-lang en
source .env.local && bun scripts/import-tsv.ts lesson-12.chunks.tsv "チャンク::L12 間接話法" --front-lang ja --back-lang en
```

チャンクのデッキは音声で使わない方針なので、投入後にデッキ一覧のチェックを外して `include_in_daily` を false にする。既存デッキへ追記する場合のみ `--append` を使う（同名デッキに追加し、裏面が重複するカードはスキップする）。

# カード生成ガイド（日本語 → 英語）

English Scrum の教材（Google ドキュメント）から、瞬間英作文用の「日本語 → 英語」カードを 2 種類生成する。

## 出力ファイル

- `generated/<slug>.sentences.tsv` — 文章デッキ用
- `generated/<slug>.chunks.tsv` — chunk デッキ用
- `generated/<slug>.vocab.txt` — その教材が「語彙リスト / Target Vocabulary」として明示している語彙を 1 行 1 語で列挙（後段の重複判定に使う）

TSV は UTF-8、ヘッダーなし、`front<TAB>back` の 2 列。フィールド内にタブ・改行・HTML を含めない。空行不可。

## 共通ルール

- front（表面）＝ 日本語。back（裏面）＝ 英語。
- 音声で「日本語を聞く → 英語で言う → 英語の模範解答を聞く」に使う。したがって
  - 日本語は「翻訳調」ではなく、日本人が実際に口にする自然な文にする。読み上げても意味が取れる文にする。
  - 日本語は、狙った英語表現を引き出せる手がかり（時制・確度・丁寧さ）を含める。例: "bound to" を狙うなら「きっと〜になるに決まっている」、"will have finished by Friday" なら「金曜までには終わらせているはずです」。
  - 英語は教材の原文をそのまま使う（言い淀み「…」や文字起こしのノイズだけ整える）。原文にない英語を創作しない。
  - 括弧書きの補足は最小限。曖昧さの解消に必要なときだけ、日本語側の末尾に短く付ける。例:「（除外する、勘定に入れない）」
- 除外する部分: 手順説明（Instructions / 手順）、理解度テストの設問文、「Your answer:」の自己回答、ディクテーション欄（Script と重複するため。ただし空欄になっていた箇所は chunk 候補として使う）、Quizlet への指示文。
- 1 枚のカードは 1 つの英語表現。同じ英語を 2 枚作らない。

## 文章デッキ（sentences）

- 対象: (a) 文法解説の例文（教材に日本語訳が付いているものは、その訳を口語に整えて使う）、(b) Script の台詞のうち「語彙リストの語を含む文」または「汎用性が高くそのまま使い回せる文」、(c) Reading Series の記事本文のうち Target Vocabulary を含む文。
- 長さ: 英語 6〜18 語程度。長い文は、意味が自立する節（カードとしてまとまった単位）に区切ってよい。区切った結果が英語として不自然な断片にならないこと。
- 会話の台詞は、話者名を付けない。文脈依存の代名詞（this / that / it）は、日本語側で軽く補ってもよいが、英語側は原文のまま。
- 目安: 1 教材あたり 15〜25 枚。

## chunk デッキ（chunks）

- 定義: 3 語以上、できれば 4 語以上の「意味を持つ言葉のかたまり」。動詞句・コロケーション・文法ターゲットのかたまり・決まり文句。
- 対象: (a) 語彙リスト / Target Vocabulary の語を、教材本文で実際に使われている形（前後の語を含めて 3 語以上）に広げたもの。例: "wastage" → "reduce headcount through natural wastage"、"stand in" → "stand in for you"、"due out" → "due out on Tuesday"。(b) ディクテーションの空欄になっていた文法ターゲット。例: "will definitely have been made by March"、"we'll be hosting departmental meetings"。(c) Script や記事中の、汎用性の高い定型句。例: "I'm just calling to say"、"I'd like to pass the next point over to"、"there's a good chance"。
- 単語 1 語・2 語のものは、本文中の用例に基づいて 3 語以上に広げる。広げられないものは作らない。
- chunk は原則として「文の一部」（主語や文末を欠いたかたまり）にする。文全体を chunk にしてよいのは、そのまま定型句として使う短い文（"I'm just calling to say" のような 8 語以内の決まり文句）だけ。完全な文は文章デッキに回す。
- 前面の日本語は「かたまりの意味」を句として書く（文にしなくてよい）。例:「〜の代わりに出る」「金曜までには決定されているはずだ」「〜と言うために電話しているだけです」。
- 目安: 1 教材あたり 15〜25 枚。

## Reading Series 固有

- 記事下の Target Vocabulary のうち、`generated/lesson-*.vocab.txt` に既出のものは優先度を下げる（完全に除外はしないが、未出の語を優先する）。
- 記事の文は長いものが多い。Target Vocabulary を含む節を、カード向きの単位（6〜18 語）に区切ってよい。
