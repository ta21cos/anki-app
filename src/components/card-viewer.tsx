"use client";

import DOMPurify from "isomorphic-dompurify";

interface CardViewerProps {
  front: string;
  back: string;
  onShowAnswer: () => void;
  showAnswer: boolean;
}

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "b",
      "i",
      "u",
      "em",
      "strong",
      "br",
      "p",
      "div",
      "span",
      "ul",
      "ol",
      "li",
      "table",
      "tr",
      "td",
      "th",
      "thead",
      "tbody",
      "sub",
      "sup",
      "ruby",
      "rt",
      "hr",
      "blockquote",
      "pre",
      "code",
      "mark",
    ],
    ALLOWED_ATTR: ["class", "style"],
  });
}

export function CardViewer({
  front,
  back,
  onShowAnswer,
  showAnswer,
}: CardViewerProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-full rounded-xl border bg-card p-6">
        <div
          className="text-center text-lg"
          dangerouslySetInnerHTML={{ __html: sanitize(front) }}
        />

        {showAnswer && (
          <>
            <hr className="my-4 border-border" />
            <div
              className="text-center text-lg text-primary"
              dangerouslySetInnerHTML={{ __html: sanitize(back) }}
            />
          </>
        )}
      </div>

      {!showAnswer && (
        <button
          onClick={onShowAnswer}
          className="mt-6 rounded-lg bg-primary px-8 py-3 text-primary-foreground transition-colors hover:bg-primary/90"
        >
          答えを見る
        </button>
      )}
    </div>
  );
}
