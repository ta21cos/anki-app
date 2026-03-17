export function stripHtmlToPlainText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;

  div.querySelectorAll("style, script").forEach((el) => el.remove());

  return (div.textContent ?? "").trim();
}

export function speak(
  text: string,
  options?: { rate?: number; onEnd?: () => void },
): SpeechSynthesisUtterance {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = options?.rate ?? 1.0;
  if (options?.onEnd) {
    utterance.onend = options.onEnd;
  }
  speechSynthesis.speak(utterance);
  return utterance;
}

export function stopSpeaking(): void {
  speechSynthesis.cancel();
}
