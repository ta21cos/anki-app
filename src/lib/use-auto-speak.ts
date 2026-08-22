import { useEffect } from "react";
import { speak, stopSpeaking, stripHtmlToPlainText } from "@/lib/tts";
import type { Lang } from "@/lib/lang";
import { useSettings } from "@/lib/settings";

type AutoSpeakCard = {
  id: string;
  front: string;
  back: string;
  frontLang: Lang;
  backLang: Lang;
};

// NOTE: 表示中のカードが変わったら表面を、答えが開いたら裏面を読み上げる。
// カード切り替え・離脱時は読み上げを止め、前のカードの音声が残らないようにする。
export function useAutoSpeak(
  card: AutoSpeakCard | null,
  isAnswerShown: boolean,
): void {
  const { autoSpeak } = useSettings();
  const cardId = card?.id ?? null;
  const html = card ? (isAnswerShown ? card.back : card.front) : "";
  const lang = card ? (isAnswerShown ? card.backLang : card.frontLang) : "en";

  useEffect(() => {
    if (!autoSpeak || cardId === null) return;
    const text = stripHtmlToPlainText(html);
    if (text) speak(text, { lang });
    return () => stopSpeaking();
  }, [autoSpeak, cardId, html, lang]);
}
