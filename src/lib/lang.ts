// NOTE: デッキの表面・裏面の読み上げ言語。worker/schema.ts の LANGS と同じ値。
export const LANGS = ["en", "ja"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_LABELS: Record<Lang, string> = {
  en: "英語",
  ja: "日本語",
};

export const LANG_SHORT_LABELS: Record<Lang, string> = {
  en: "英",
  ja: "日",
};

// NOTE: Web Speech API に渡す BCP 47 ロケール
export const SPEECH_LOCALES: Record<Lang, string> = {
  en: "en-US",
  ja: "ja-JP",
};

export function isLang(value: unknown): value is Lang {
  return (
    typeof value === "string" && (LANGS as readonly string[]).includes(value)
  );
}

export function formatLangPair(frontLang: Lang, backLang: Lang): string {
  return `${LANG_SHORT_LABELS[frontLang]}→${LANG_SHORT_LABELS[backLang]}`;
}
