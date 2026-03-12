import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
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
];

export function sanitizeHtml(html: string): string {
  const withoutMedia = removeMediaReferences(html);
  return DOMPurify.sanitize(withoutMedia, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["class"],
  });
}

function removeMediaReferences(html: string): string {
  let result = html;
  result = result.replace(/<img[^>]*>/gi, "");
  result = result.replace(/<(audio|video)[^>]*>[\s\S]*?<\/\1>/gi, "");
  result = result.replace(/<(audio|video)[^>]*\/?>/gi, "");
  result = result.replace(/<source[^>]*\/?>/gi, "");
  result = result.replace(/\[sound:[^\]]*\]/gi, "");
  return result;
}
