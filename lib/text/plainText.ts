// Every string in this CMS renders as plain text into a styled element on the site. There is
// no markdown renderer and no `dangerouslySetInnerHTML` anywhere in the front end, so
// anything HTML-ish that survives a save will show up on the site as literal angle brackets.
//
// The split below is deliberate:
//
//   - HTML is STRIPPED on save. `<p>` in prose is never intentional, so removing it silently
//     is safe and unambiguous.
//   - Markdown is only FLAGGED, never stripped. The site's voice leans on asterisks-free
//     prose but does use underscores and dashes inside real sentences, and quietly rewriting
//     an editor's words is worse than telling them what will happen.

const HTML_TAG = /<\/?[a-z][^>]*>/gi;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&rdquo;": "”",
  "&ldquo;": "“",
};

/**
 * Normalises a single-line value: strips HTML, decodes entities, collapses all whitespace
 * (including pasted newlines) to single spaces, and trims.
 */
export function toPlainLine(value: string): string {
  return decodeEntities(stripHtml(value)).replace(/\s+/g, " ").trim();
}

/**
 * Normalises a paragraph: strips HTML and decodes entities, but preserves the paragraph as
 * one run of text. Internal newlines collapse to spaces because each paragraph is rendered
 * as a single `<p>` — a newline inside one would just become a space in the browser anyway.
 */
export function toPlainParagraph(value: string): string {
  return toPlainLine(value);
}

/**
 * Splits a textarea into paragraphs on blank lines, so an editor can paste or type a whole
 * answer at once instead of managing a repeatable-input widget by hand.
 */
export function splitIntoParagraphs(value: string): string[] {
  return value
    .split(/\n\s*\n/)
    .map((paragraph) => toPlainParagraph(paragraph))
    .filter((paragraph) => paragraph.length > 0);
}

/**
 * The inverse of `splitIntoParagraphs`, for loading stored paragraphs back into a textarea.
 */
export function joinParagraphs(paragraphs: string[]): string {
  return paragraphs.join("\n\n");
}

function stripHtml(value: string): string {
  return value.replace(HTML_COMMENT, "").replace(HTML_TAG, "");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&[a-z]+;|&#39;/gi, (entity) => NAMED_ENTITIES[entity.toLowerCase()] ?? entity);
}

/**
 * Markdown that would render as literal characters on the site. Returned as a warning for
 * the editor rather than being rewritten.
 */
export function findMarkdownWarnings(value: string): string[] {
  const warnings: string[] = [];

  if (/\*\*[^*]+\*\*|\*[^*\s][^*]*\*/.test(value)) {
    warnings.push("Asterisks won't render as bold or italic — they'll show as literal *.");
  }
  if (/\[[^\]]+\]\([^)]+\)/.test(value)) {
    warnings.push("Markdown links aren't supported — the [text](url) syntax will show as-is.");
  }
  if (/^\s*#{1,6}\s/m.test(value)) {
    warnings.push("Heading syntax (#) will show as a literal hash.");
  }
  if (/^\s*[-*+]\s+/m.test(value)) {
    warnings.push("Bullet syntax won't render as a list — use separate paragraphs instead.");
  }
  if (/`[^`]+`/.test(value)) {
    warnings.push("Backticks won't render as code — they'll show as literal backticks.");
  }

  return warnings;
}
