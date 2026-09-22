export const BLOG_BLOCK_KINDS = [
  "PARAGRAPH",
  "HEADING_2",
  "HEADING_3",
  "LIST_ITEM",
] as const;

export type BlogBlockKind = (typeof BLOG_BLOCK_KINDS)[number];

export interface BlogBlockInput {
  kind: BlogBlockKind;
  body: string;
}

/**
 * Parse the CMS's deliberately small article syntax. It preserves the hierarchy needed by the
 * public page without accepting arbitrary Markdown or HTML.
 */
export function parseBlogBlocks(value: string): BlogBlockInput[] {
  const blocks: BlogBlockInput[] = [];
  let paragraphLines: string[] = [];

  function flushParagraph() {
    const body = paragraphLines.join(" ").trim();
    if (body) blocks.push({ kind: "PARAGRAPH", body });
    paragraphLines = [];
  }

  for (const rawLine of value.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    const heading3 = /^###\s+(.+)$/.exec(line);
    const heading2 = /^##\s+(.+)$/.exec(line);
    const listItem = /^[-*]\s+(.+)$/.exec(line);
    const structural = heading3 ?? heading2 ?? listItem;

    if (structural) {
      flushParagraph();
      blocks.push({
        kind: heading3 ? "HEADING_3" : heading2 ? "HEADING_2" : "LIST_ITEM",
        body: structural[1].trim(),
      });
      continue;
    }

    paragraphLines.push(line);
  }

  flushParagraph();
  return blocks;
}

export function serialiseBlogBlocks(blocks: readonly BlogBlockInput[]): string {
  return blocks.reduce((value, block, index) => {
    const prefix = block.kind === "HEADING_2"
      ? "## "
      : block.kind === "HEADING_3"
        ? "### "
        : block.kind === "LIST_ITEM"
          ? "- "
          : "";
    const previous = blocks[index - 1];
    const separator = index === 0
      ? ""
      : block.kind === "LIST_ITEM" && previous?.kind === "LIST_ITEM"
        ? "\n"
        : "\n\n";

    return `${value}${separator}${prefix}${block.body}`;
  }, "");
}
