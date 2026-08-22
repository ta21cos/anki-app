import { Volume2, VolumeX } from "lucide-react";
import { updateSettings, useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

// NOTE: 学習画面ヘッダー用の ON / OFF アイコン。状態は設定ストア経由で
// localStorage に保存されるため、設定画面のスイッチと常に同期する。
export function AutoSpeakToggle({ className }: { className?: string }) {
  const { autoSpeak } = useSettings();
  const label = autoSpeak ? "自動読み上げ オン" : "自動読み上げ オフ";
  const Icon = autoSpeak ? Volume2 : VolumeX;

  return (
    <button
      type="button"
      onClick={() => updateSettings({ autoSpeak: !autoSpeak })}
      aria-label={label}
      aria-pressed={autoSpeak}
      title={label}
      className={cn(
        "rounded-md p-1.5 transition-colors",
        autoSpeak
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
