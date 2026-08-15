import { apiFetch } from "./client";
import { stripHtmlToPlainText } from "@/lib/tts";

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

type QuizCard = { id: string; deckId: string; front: string; back: string };

// 表面・裏面を TTS セグメント化（サーバー側で KV キャッシュ）した後、
// 1 本の番組 mp3 に合成する。バッチ分割は Workers のサブリクエスト
// 上限に合わせたサーバー側の制約に従う。
export async function prepareAudioQuiz(
  cards: QuizCard[],
  pauseSeconds: number,
  onProgress?: (done: number, total: number) => void,
): Promise<AudioSession> {
  const texts = cards.flatMap((card) => [
    stripHtmlToPlainText(card.front),
    stripHtmlToPlainText(card.back),
  ]);

  const batches = Array.from(
    { length: Math.ceil(texts.length / SEGMENT_BATCH_SIZE) },
    (_, i) => texts.slice(i * SEGMENT_BATCH_SIZE, (i + 1) * SEGMENT_BATCH_SIZE),
  );

  const keys: string[] = [];
  for (const [index, batch] of batches.entries()) {
    const result = await apiFetch<{ keys: string[] }>("/audio/segments", {
      method: "POST",
      body: JSON.stringify({ texts: batch }),
    });
    keys.push(...result.keys);
    onProgress?.(
      Math.min((index + 1) * SEGMENT_BATCH_SIZE, texts.length),
      texts.length,
    );
  }

  const items = cards.map((card, i) => ({
    cardId: card.id,
    deckId: card.deckId,
    front: card.front,
    promptKey: keys[i * 2],
    answerKey: keys[i * 2 + 1],
  }));

  return apiFetch<AudioSession>("/audio/compile", {
    method: "POST",
    body: JSON.stringify({ items, pauseSeconds }),
  });
}

export function audioFileUrl(sessionKey: string): string {
  return `/api/audio/file/${sessionKey}`;
}
