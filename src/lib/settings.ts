import { useSyncExternalStore } from "react";

export type Settings = {
  autoSpeak: boolean;
  recallPauseSeconds: number;
  cardGapSeconds: number;
};

export const SETTINGS_STORAGE_KEY = "anki-app.settings";
export const INTERVAL_MIN_SECONDS = 1;
export const INTERVAL_MAX_SECONDS = 15;

export const DEFAULT_SETTINGS: Settings = {
  autoSpeak: true,
  recallPauseSeconds: 6,
  cardGapSeconds: 3,
};

function isIntervalSeconds(candidate: unknown): candidate is number {
  return (
    typeof candidate === "number" &&
    Number.isInteger(candidate) &&
    candidate >= INTERVAL_MIN_SECONDS &&
    candidate <= INTERVAL_MAX_SECONDS
  );
}

// NOTE: localStorage が壊れていてもアプリが落ちないよう、項目ごとに検証して
// 不正な値だけ既定値に戻す。
function sanitizeSettings(raw: unknown): Settings {
  const source =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  return {
    autoSpeak:
      typeof source.autoSpeak === "boolean"
        ? source.autoSpeak
        : DEFAULT_SETTINGS.autoSpeak,
    recallPauseSeconds: isIntervalSeconds(source.recallPauseSeconds)
      ? source.recallPauseSeconds
      : DEFAULT_SETTINGS.recallPauseSeconds,
    cardGapSeconds: isIntervalSeconds(source.cardGapSeconds)
      ? source.cardGapSeconds
      : DEFAULT_SETTINGS.cardGapSeconds,
  };
}

function readSettings(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return stored ? sanitizeSettings(JSON.parse(stored)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const store = {
  snapshot: readSettings(),
  listeners: new Set<() => void>(),
};

function subscribe(listener: () => void): () => void {
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

function getSnapshot(): Settings {
  return store.snapshot;
}

export function updateSettings(partial: Partial<Settings>): void {
  store.snapshot = sanitizeSettings({ ...store.snapshot, ...partial });
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(store.snapshot));
  } catch {
    // NOTE: プライベートモード等で保存できなくても、このセッション内の設定は活かす
  }
  store.listeners.forEach((listener) => listener());
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
