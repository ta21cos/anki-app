import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Env } from "./db";
import { isLang, type Lang } from "./schema";
import silenceMp3 from "./silence-1s.mp3";

// gpt-4o-mini-tts の mp3 出力は 24kHz mono 128kbps CBR。
// silence-1s.mp3 も同一パラメータ（ヘッダーなし）で生成してあり、
// フレーム境界でのバイト連結がそのまま有効な mp3 になる。
const TTS_MODEL = "gpt-4o-mini-tts";
const TTS_VOICE = "alloy";
// NOTE: alloy は多言語対応だが、言語を明示しないと日本語の短文を英語風に
// 読むことがあるため、言語ごとに読み方の指示を添える。
const TTS_INSTRUCTIONS: Record<Lang, string> = {
  en: "Speak clearly in natural American English at a moderate pace.",
  ja: "自然な日本語で、はっきりと落ち着いた速さで読み上げてください。",
};
const MP3_BYTES_PER_SECOND = 16000;

const MAX_SEGMENTS_PER_BATCH = 8;
const MAX_ITEMS_PER_SESSION = 20;

type Variables = { ownerId: string };

export const audioApp = new Hono<{ Bindings: Env; Variables: Variables }>();

async function segmentKey(text: string, lang: Lang): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${TTS_MODEL}|${TTS_VOICE}|${lang}|${text}`),
  );
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `seg/${hex}.mp3`;
}

async function synthesize(
  env: Env,
  text: string,
  lang: Lang,
): Promise<ArrayBuffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: text,
      instructions: TTS_INSTRUCTIONS[lang],
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    throw new HTTPException(502, {
      message: `TTS failed: ${res.status} ${(await res.text()).slice(0, 200)}`,
    });
  }
  return res.arrayBuffer();
}

type SegmentItem = { text: string; lang: Lang };

function isSegmentItem(value: unknown): value is SegmentItem {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as SegmentItem).text === "string" &&
    isLang((value as SegmentItem).lang)
  );
}

// NOTE: テキスト群を言語付きで TTS 化して KV にキャッシュする。バッチ上限は
// Workers のサブリクエスト上限（無料プランで 50/リクエスト）に収めるため。
audioApp.post("/segments", async (c) => {
  const { items } = (await c.req.json()) as { items: unknown };
  if (!Array.isArray(items) || items.length === 0) {
    throw new HTTPException(400, { message: "items is required" });
  }
  if (items.length > MAX_SEGMENTS_PER_BATCH) {
    throw new HTTPException(400, {
      message: `items must be at most ${MAX_SEGMENTS_PER_BATCH}`,
    });
  }
  if (!items.every(isSegmentItem)) {
    throw new HTTPException(400, {
      message: "each item must have text and lang (en | ja)",
    });
  }

  const keys: string[] = [];
  for (const item of items) {
    const key = await segmentKey(item.text, item.lang);
    const cached = await c.env.AUDIO_KV.get(key, "arrayBuffer");
    if (!cached) {
      const audio = await synthesize(c.env, item.text, item.lang);
      await c.env.AUDIO_KV.put(key, audio);
    }
    keys.push(key);
  }
  return c.json({ keys });
});

type CompileItem = {
  cardId: string;
  deckId: string;
  front: string;
  promptKey: string;
  answerKey: string;
};

type ManifestItem = {
  cardId: string;
  deckId: string;
  front: string;
  promptStart: number;
  answerStart: number;
  end: number;
};

function clampSilenceSeconds(seconds: number): number {
  const rounded = Number.isFinite(seconds) ? Math.round(seconds) : 1;
  return Math.min(Math.max(rounded, 1), 15);
}

// NOTE: [プロンプト][ポーズ][答え][ポーズ] を連結して 1 本の mp3 にする。
// 1 ファイルなのは iOS がロック画面で speechSynthesis / Web Audio を止めるため。
audioApp.post("/compile", async (c) => {
  const { items, pauseSeconds, gapSeconds } = (await c.req.json()) as {
    items: CompileItem[];
    pauseSeconds: number;
    gapSeconds?: number;
  };
  if (!Array.isArray(items) || items.length === 0) {
    throw new HTTPException(400, { message: "items is required" });
  }
  if (items.length > MAX_ITEMS_PER_SESSION) {
    throw new HTTPException(400, {
      message: `items must be at most ${MAX_ITEMS_PER_SESSION}`,
    });
  }
  // NOTE: 無音は 1 秒 mp3 の繰り返しなので整数秒に丸める。設定画面の 1〜15 秒と同じ範囲。
  const pauseCount = clampSilenceSeconds(pauseSeconds);
  const gapCount = clampSilenceSeconds(gapSeconds ?? pauseSeconds);

  const silence = new Uint8Array(silenceMp3);

  const parts: Uint8Array[] = [];
  const manifest: ManifestItem[] = [];
  const state = { seconds: 0 };

  const push = (bytes: Uint8Array) => {
    parts.push(bytes);
    state.seconds += bytes.byteLength / MP3_BYTES_PER_SECOND;
  };

  for (const item of items) {
    const [prompt, answer] = await Promise.all([
      c.env.AUDIO_KV.get(item.promptKey, "arrayBuffer"),
      c.env.AUDIO_KV.get(item.answerKey, "arrayBuffer"),
    ]);
    if (!prompt || !answer) {
      throw new HTTPException(400, {
        message: `segment not found for card ${item.cardId}`,
      });
    }

    const promptStart = state.seconds;
    push(new Uint8Array(prompt));
    Array.from({ length: pauseCount }).forEach(() => push(silence));
    const answerStart = state.seconds;
    push(new Uint8Array(answer));
    Array.from({ length: gapCount }).forEach(() => push(silence));

    manifest.push({
      cardId: item.cardId,
      deckId: item.deckId,
      front: item.front,
      promptStart,
      answerStart,
      end: state.seconds,
    });
  }

  const total = parts.reduce((sum, p) => sum + p.byteLength, 0);
  const merged = new Uint8Array(total);
  parts.reduce((offset, p) => {
    merged.set(p, offset);
    return offset + p.byteLength;
  }, 0);

  const sessionKey = `session/${crypto.randomUUID()}.mp3`;
  // 番組は使い捨てのため 1 日で自然消滅させる
  await c.env.AUDIO_KV.put(sessionKey, merged.buffer, { expirationTtl: 86400 });

  return c.json({
    sessionKey,
    manifest,
    totalSeconds: state.seconds,
  });
});

// KV 上の音声を配信する。iOS の audio 要素はシークや再開時に
// Range リクエストを送るため、206 での部分応答に対応する。
audioApp.get("/file/*", async (c) => {
  const key = c.req.path.replace(/^\/api\/audio\/file\//, "");
  const data = await c.env.AUDIO_KV.get(key, "arrayBuffer");
  if (!data) {
    throw new HTTPException(404, { message: "audio not found" });
  }

  const range = c.req.header("Range");
  const total = data.byteLength;

  if (range) {
    const match = range.match(/bytes=(\d*)-(\d*)/);
    const start = match?.[1] ? Number(match[1]) : 0;
    const end = match?.[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
    if (start >= total || start > end) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${total}` },
      });
    }
    return new Response(data.slice(start, end + 1), {
      status: 206,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  return new Response(data, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
});
