import { LANGS, LANG_LABELS, type Lang } from "@/lib/lang";
import { cn } from "@/lib/utils";

interface LangPairSelectorProps {
  frontLang: Lang;
  backLang: Lang;
  onChange: (langs: { frontLang: Lang; backLang: Lang }) => void;
  disabled?: boolean;
  idPrefix?: string;
  className?: string;
}

// 表面・裏面の読み上げ言語を選ぶ。読み上げ・音声クイズの TTS ロケール、
// および Web Speech のロケール選択に使われる。
export function LangPairSelector({
  frontLang,
  backLang,
  onChange,
  disabled,
  idPrefix = "deck-lang",
  className,
}: LangPairSelectorProps) {
  const selectClass =
    "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      <div>
        <label
          htmlFor={`${idPrefix}-front`}
          className="mb-1 block text-xs font-medium text-muted-foreground"
        >
          表面の言語
        </label>
        <select
          id={`${idPrefix}-front`}
          value={frontLang}
          disabled={disabled}
          onChange={(e) =>
            onChange({ frontLang: e.target.value as Lang, backLang })
          }
          className={selectClass}
        >
          {LANGS.map((lang) => (
            <option key={lang} value={lang}>
              {LANG_LABELS[lang]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor={`${idPrefix}-back`}
          className="mb-1 block text-xs font-medium text-muted-foreground"
        >
          裏面の言語
        </label>
        <select
          id={`${idPrefix}-back`}
          value={backLang}
          disabled={disabled}
          onChange={(e) =>
            onChange({ frontLang, backLang: e.target.value as Lang })
          }
          className={selectClass}
        >
          {LANGS.map((lang) => (
            <option key={lang} value={lang}>
              {LANG_LABELS[lang]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
