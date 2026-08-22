import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  INTERVAL_MAX_SECONDS,
  INTERVAL_MIN_SECONDS,
  updateSettings,
  useSettings,
  type Settings,
} from "@/lib/settings";
import { cn } from "@/lib/utils";

type IntervalKey = "recallPauseSeconds" | "cardGapSeconds";

const INTERVAL_ITEMS: { key: IntervalKey; label: string }[] = [
  { key: "recallPauseSeconds", label: "表面 → 裏面（想起ポーズ）" },
  { key: "cardGapSeconds", label: "カード間" },
];

export function SettingsPage() {
  const settings = useSettings();

  return (
    <div className="px-4 pt-6">
      <h1 className="mb-6 text-lg font-semibold">設定</h1>

      <div className="space-y-8">
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            自動読み上げ
          </h2>
          <AutoSpeakSwitch isOn={settings.autoSpeak} />
          <p className="mt-1.5 text-xs text-muted-foreground">
            カード学習で表面と裏面を表示したときに自動で読み上げます
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            音声クイズの間隔
          </h2>
          <div className="space-y-3">
            {INTERVAL_ITEMS.map(({ key, label }) => (
              <IntervalStepper
                key={key}
                label={label}
                seconds={settings[key]}
                onChange={(seconds) => updateSettings({ [key]: seconds })}
              />
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            表面を読んだあと思い出すための無音と、裏面を読んだあと次のカードまでの無音です
          </p>
        </section>
      </div>
    </div>
  );
}

function AutoSpeakSwitch({ isOn }: { isOn: Settings["autoSpeak"] }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5">
      <span className="text-sm">カード学習で自動読み上げ</span>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label="自動読み上げ"
        onClick={() => updateSettings({ autoSpeak: !isOn })}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          isOn ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-background shadow transition-transform",
            isOn ? "translate-x-5.5" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}

function IntervalStepper({
  label,
  seconds,
  onChange,
}: {
  label: string;
  seconds: number;
  onChange: (seconds: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-xs"
          aria-label={`${label} を 1 秒短く`}
          onClick={() => onChange(seconds - 1)}
          disabled={seconds <= INTERVAL_MIN_SECONDS}
        >
          <Minus className="size-3" />
        </Button>
        <span className="w-12 text-center text-sm font-medium">
          {seconds} 秒
        </span>
        <Button
          variant="outline"
          size="icon-xs"
          aria-label={`${label} を 1 秒長く`}
          onClick={() => onChange(seconds + 1)}
          disabled={seconds >= INTERVAL_MAX_SECONDS}
        >
          <Plus className="size-3" />
        </Button>
      </div>
    </div>
  );
}
