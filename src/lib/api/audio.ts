import { apiFetch } from "./client";
import { stripHtmlToPlainText } from "@/lib/tts";
import type { Lang } from "@/lib/lang";

export type AudioManifestItem = {
  cardId: string;
  deckId: string;
  front: string;
  promptStart: number;
  answerStart: number;
  end: number;
};

export type AudioSession = {
  sessionKey: string;
  manifest: AudioManifestItem[];
  totalSeconds: number;
};

export const AUDIO_QUIZ_MAX_CARDS = 20;

const SEGMENT_BATCH_SIZE = 8;

export type QuizCard = {
  id: string;
  deckId: string;
  front: string;
  back: string;
  frontLang: Lang;
  backLang: Lang;
};

type SegmentItem = { text: string; lang: Lang };

// NOTE: 表面・裏面を言語付きで TTS セグメント化した後、1 本の番組 mp3 に
// 合成する。バッチ分割は Workers のサブリクエスト上限に合わせた制約に従う。
export type AudioQuizIntervals = {
  // 表面を読んだ後、思い出すための無音（秒）
  pauseSeconds: number;
  // 裏面を読んだ後、次のカードまでの無音（秒）
  gapSeconds: number;
};

export async function prepareAudioQuiz(
  cards: QuizCard[],
  { pauseSeconds, gapSeconds }: AudioQuizIntervals,
  onProgress?: (done: number, total: number) => void,
): Promise<AudioSession> {
  const items: SegmentItem[] = cards.flatMap((card) => [
    { text: stripHtmlToPlainText(card.front), lang: card.frontLang },
    { text: stripHtmlToPlainText(card.back), lang: card.backLang },
  ]);

  const batches = Array.from(
    { length: Math.ceil(items.length / SEGMENT_BATCH_SIZE) },
    (_, i) => items.slice(i * SEGMENT_BATCH_SIZE, (i + 1) * SEGMENT_BATCH_SIZE),
  );

  const keys: string[] = [];
  for (const [index, batch] of batches.entries()) {
    const result = await apiFetch<{ keys: string[] }>("/audio/segments", {
      method: "POST",
      body: JSON.stringify({ items: batch }),
    });
    keys.push(...result.keys);
    onProgress?.(
      Math.min((index + 1) * SEGMENT_BATCH_SIZE, items.length),
      items.length,
    );
  }

  const compileItems = cards.map((card, i) => ({
    cardId: card.id,
    deckId: card.deckId,
    front: card.front,
    promptKey: keys[i * 2],
    answerKey: keys[i * 2 + 1],
  }));

  return apiFetch<AudioSession>("/audio/compile", {
    method: "POST",
    body: JSON.stringify({ items: compileItems, pauseSeconds, gapSeconds }),
  });
}

export function audioFileUrl(sessionKey: string): string {
  return `/api/audio/file/${sessionKey}`;
}
