import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { speak, stopSpeaking, stripHtmlToPlainText } from "@/lib/tts";
import type { Lang } from "@/lib/lang";
import { useSettings } from "@/lib/settings";
import {
  fetchSegmentKeys,
  playSegment,
  stopAudio,
  type SegmentItem,
} from "@/lib/card-audio";

export type CardAudioCard = {
  id: string;
  front: string;
  back: string;
  frontLang: Lang;
  backLang: Lang;
};

export type CardSide = "front" | "back";
export type CardAudioStatus = "loading" | "ready" | "error";

type SegmentKeysBySide = Record<CardSide, string | null>;

type ResolvedSegments = {
  cardId: string;
  status: CardAudioStatus;
  keys: SegmentKeysBySide | null;
};

export type CardAudio = {
  status: CardAudioStatus;
  isPlaying: CardSide | null;
  playFront: () => void;
  playBack: () => void;
};

// NOTE: 裏面の鍵も表面と同時に取得し、答えを開いた瞬間に裏面を鳴らせるようにする。
// 生成音声が取れないとき（API キー未設定・通信失敗）は Web Speech に退避する。
export function useCardAudio(
  card: CardAudioCard | null,
  isAnswerShown: boolean,
): CardAudio {
  const { autoSpeak } = useSettings();
  const cardId = card?.id ?? null;
  const frontHtml = card?.front ?? "";
  const backHtml = card?.back ?? "";
  const frontLang = card?.frontLang ?? "en";
  const backLang = card?.backLang ?? "en";

  const frontText = useMemo(() => stripHtmlToPlainText(frontHtml), [frontHtml]);
  const backText = useMemo(() => stripHtmlToPlainText(backHtml), [backHtml]);

  const [resolved, setResolved] = useState<ResolvedSegments | null>(null);
  const [isPlaying, setIsPlaying] = useState<CardSide | null>(null);
  const autoPlayedMarkerRef = useRef<string | null>(null);

  useEffect(() => {
    stopAudio();
    stopSpeaking();
    setIsPlaying(null);
    autoPlayedMarkerRef.current = null;
    if (cardId === null) {
      setResolved(null);
      return;
    }

    const candidates: { side: CardSide; item: SegmentItem }[] = [
      { side: "front", item: { text: frontText, lang: frontLang } },
      { side: "back", item: { text: backText, lang: backLang } },
    ];
    const requested = candidates.filter(({ item }) => item.text !== "");
    if (requested.length === 0) {
      setResolved({
        cardId,
        status: "ready",
        keys: { front: null, back: null },
      });
      return;
    }

    const lifecycle = { isCancelled: false };
    setResolved({ cardId, status: "loading", keys: null });
    fetchSegmentKeys(requested.map(({ item }) => item))
      .then((keys) => {
        if (lifecycle.isCancelled) return;
        const keysBySide: SegmentKeysBySide = { front: null, back: null };
        requested.forEach(({ side }, index) => {
          keysBySide[side] = keys[index] ?? null;
        });
        setResolved({ cardId, status: "ready", keys: keysBySide });
      })
      .catch(() => {
        if (lifecycle.isCancelled) return;
        setResolved({ cardId, status: "error", keys: null });
      });

    return () => {
      lifecycle.isCancelled = true;
      stopAudio();
      stopSpeaking();
    };
  }, [cardId, frontText, backText, frontLang, backLang]);

  const currentResolved =
    resolved !== null && resolved.cardId === cardId ? resolved : null;
  const status: CardAudioStatus = currentResolved?.status ?? "loading";

  const play = useCallback(
    (side: CardSide) => {
      if (currentResolved === null || currentResolved.status === "loading") {
        return;
      }
      stopSpeaking();
      stopAudio();
      const key = currentResolved.keys?.[side] ?? null;
      if (currentResolved.status === "ready") {
        if (key === null) return;
        setIsPlaying(side);
        playSegment(key, () => setIsPlaying(null));
        return;
      }
      const text = side === "front" ? frontText : backText;
      if (text === "") return;
      setIsPlaying(side);
      speak(text, {
        lang: side === "front" ? frontLang : backLang,
        onEnd: () => setIsPlaying(null),
      });
    },
    [currentResolved, frontText, backText, frontLang, backLang],
  );

  useEffect(() => {
    if (!autoSpeak || cardId === null || status === "loading") return;
    const side: CardSide = isAnswerShown ? "back" : "front";
    const marker = `${cardId}:${side}`;
    if (autoPlayedMarkerRef.current === marker) return;
    autoPlayedMarkerRef.current = marker;
    play(side);
  }, [autoSpeak, cardId, status, isAnswerShown, play]);

  const playFront = useCallback(() => play("front"), [play]);
  const playBack = useCallback(() => play("back"), [play]);

  return { status, isPlaying, playFront, playBack };
}
