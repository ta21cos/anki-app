import { Volume2 } from "lucide-react";
import type { CardAudio } from "@/lib/use-card-audio";
import { cn } from "@/lib/utils";

type CardAudioButtonsProps = {
  audio: CardAudio;
  isAnswerShown: boolean;
};

function ReplayButton({
  label,
  isActive,
  disabled,
  onClick,
}: {
  label: string;
  isActive: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-50",
        isActive
          ? "border-primary/40 bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Volume2 className="size-4" />
      {label}
    </button>
  );
}

// NOTE: 自動読み上げが OFF でも手動で聞けるよう、ボタンは設定に関係なく出す。
export function CardAudioButtons({
  audio,
  isAnswerShown,
}: CardAudioButtonsProps) {
  const isLoading = audio.status === "loading";
  return (
    <div className="mt-3 flex items-center gap-2">
      <ReplayButton
        label="表面を再生"
        isActive={audio.isPlaying === "front"}
        disabled={isLoading}
        onClick={audio.playFront}
      />
      {isAnswerShown && (
        <ReplayButton
          label="裏面を再生"
          isActive={audio.isPlaying === "back"}
          disabled={isLoading}
          onClick={audio.playBack}
        />
      )}
    </div>
  );
}
