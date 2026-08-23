import { apiFetch } from "@/lib/api/client";
import { audioFileUrl } from "@/lib/api/audio";
import type { Lang } from "@/lib/lang";

export type SegmentItem = { text: string; lang: Lang };

export async function fetchSegmentKeys(
  items: SegmentItem[],
): Promise<string[]> {
  const segmentResponse = await apiFetch<{ keys: string[] }>(
    "/audio/segments",
    {
      method: "POST",
      body: JSON.stringify({ items }),
    },
  );
  return segmentResponse.keys;
}

// NOTE: 暗記カードの読み上げは常に 1 本ずつなので、画面全体で 1 つの
// HTMLAudioElement を使い回し、前の音声が重なって鳴らないようにする。
const playerState: { audio: HTMLAudioElement | null } = { audio: null };

function getPlayer(): HTMLAudioElement {
  if (playerState.audio === null) {
    const audio = new Audio();
    audio.preload = "auto";
    audio.dataset.role = "card-audio";
    playerState.audio = audio;
  }
  return playerState.audio;
}

export function playSegment(key: string, onEnd: () => void): void {
  const audio = getPlayer();
  audio.onended = null;
  audio.pause();
  audio.src = audioFileUrl(key);
  audio.currentTime = 0;
  audio.onended = onEnd;
  // NOTE: モバイルではジェスチャー前の自動再生が拒否されるため、失敗は握りつぶして
  // 再生ボタン（ジェスチャー）からの再生に任せる。
  audio.play().catch(() => onEnd());
}

export function stopAudio(): void {
  if (playerState.audio === null) return;
  playerState.audio.onended = null;
  playerState.audio.pause();
}
