import { useEffect, useRef, useState } from "react";
import {
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Headphones,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  audioFileUrl,
  type AudioManifestItem,
  type AudioSession,
} from "@/lib/api/audio";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function itemIndexAt(manifest: AudioManifestItem[], time: number): number {
  const index = manifest.findIndex((item) => time < item.end);
  return index === -1 ? manifest.length - 1 : index;
}

export function AudioQuizPlayer({
  session,
  deckNameMap,
  onExit,
}: {
  session: AudioSession;
  deckNameMap: Record<string, string>;
  onExit: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const { manifest } = session;
  const currentIndex = itemIndexAt(manifest, currentTime);
  const currentItem = manifest[currentIndex];
  const phase =
    currentItem && currentTime >= currentItem.answerStart ? "answer" : "recall";

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    audio.play();
  };

  // ロック画面・イヤホンからの操作を番組内の項目移動に割り当てる
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const audio = audioRef.current;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: "音声クイズ",
      artist: "AnkiPWA",
    });
    navigator.mediaSession.setActionHandler("play", () => audio?.play());
    navigator.mediaSession.setActionHandler("pause", () => audio?.pause());
    navigator.mediaSession.setActionHandler("previoustrack", () => {
      const audio2 = audioRef.current;
      if (!audio2) return;
      const index = itemIndexAt(manifest, audio2.currentTime);
      const target = manifest[Math.max(0, index - 1)];
      audio2.currentTime = target.promptStart;
      audio2.play();
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => {
      const audio2 = audioRef.current;
      if (!audio2) return;
      const index = itemIndexAt(manifest, audio2.currentTime);
      const target = manifest[Math.min(manifest.length - 1, index + 1)];
      audio2.currentTime = target.promptStart;
      audio2.play();
    });

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
    };
  }, [manifest]);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 px-4 pt-10">
      <audio
        ref={audioRef}
        src={audioFileUrl(session.sessionKey)}
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="flex items-center gap-2 text-muted-foreground">
        <Headphones className="size-5" />
        <span className="text-sm">
          {currentIndex + 1} / {manifest.length}
        </span>
        <span className="text-xs">
          {formatTime(currentTime)} / {formatTime(session.totalSeconds)}
        </span>
      </div>

      <div className="flex min-h-32 w-full max-w-md flex-col items-center justify-center gap-3 rounded-lg border p-6">
        {currentItem && (
          <>
            <p className="text-center text-lg font-medium">
              {stripHtml(currentItem.front)}
            </p>
            <div className="flex items-center gap-2">
              <span
                className={
                  phase === "recall"
                    ? "rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                    : "rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                }
              >
                {phase === "recall" ? "思い出してください…" : "答え"}
              </span>
              {deckNameMap[currentItem.deckId] && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {deckNameMap[currentItem.deckId]}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() =>
            seekTo(manifest[Math.max(0, currentIndex - 1)].promptStart)
          }
          disabled={currentIndex === 0 && currentTime < 1}
        >
          <SkipBack className="size-5" />
        </Button>

        <Button
          size="icon-lg"
          onClick={handlePlayPause}
          className="rounded-full"
        >
          {isPlaying ? (
            <Pause className="size-5" />
          ) : (
            <Play className="size-5 ml-0.5" />
          )}
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={() =>
            seekTo(
              manifest[Math.min(manifest.length - 1, currentIndex + 1)]
                .promptStart,
            )
          }
          disabled={currentIndex >= manifest.length - 1}
        >
          <SkipForward className="size-5" />
        </Button>
      </div>

      <button
        onClick={() => seekTo(currentItem?.promptStart ?? 0)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <RotateCcw className="size-4" />
        この問題をもう一度
      </button>

      <p className="max-w-md text-center text-xs text-muted-foreground">
        画面をロックしても再生は続きます。イヤホンの曲送り / 曲戻しで 次の問題 /
        前の問題に移動できます
      </p>

      <button onClick={onExit} className="text-primary underline">
        終了する
      </button>
    </div>
  );
}
