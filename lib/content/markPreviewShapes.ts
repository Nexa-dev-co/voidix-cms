import { Shape } from "three";
import type * as THREE from "three";

import { letterToShapes, svgToShapes } from "@/lib/content/siteWorksField/markBody";
import type { PreparedMark } from "@/lib/content/siteWorksField/transitions/markTransition";

/**
 * One mark, resolved the way the site resolves it.
 *
 * ── ⚠ THE FALLBACK IS PART OF THE ANSWER, NOT AN ERROR PATH ─────────────────────────────────────
 * `prepareMarks.ts` on the site does exactly this for four projects at once, and the case worth
 * previewing is the one it exists for: an SVG that PARSES but yields no shapes — a stroke-only icon
 * — falls back to the project's initial. An editor who uploads one and is shown a letter has been
 * told the truth in the only way that cannot be misread. Showing them an error instead would leave
 * them guessing what the site does with it.
 *
 * ⚠ The typeface is helvetiker, not Syne, because that is what the site has (three ships it and the
 * brand face is a hashed woff2 in the build output). A letter mark reads generic on the site too —
 * this is not the preview being approximate.
 *
 * Not vendored, because it is not the site's file: `prepareMarks` resolves a whole ordered array
 * against a content payload and guarantees no holes in it. One mark, one answer, no ordering
 * contract to keep — a copy of that function would be 150 lines of comments about a problem this
 * side does not have.
 */

const FONT_PATH = "/fonts/helvetiker_bold.typeface.json";

/** Which of the two things the site ended up growing, so the preview can say so out loud. */
export type MarkPreviewOrigin = "svg" | "initial";

export interface ResolvedPreviewMark {
  mark: PreparedMark;
  origin: MarkPreviewOrigin;
}

export async function resolvePreviewMark(
  source: string | null,
  title: string,
): Promise<ResolvedPreviewMark> {
  const svgShapes = source ? shapesFromSvg(source) : null;

  if (svgShapes) {
    return {
      // SVG's Y axis points down. The flag travels with the mark rather than being applied here —
      // see `markTransition.ts`, which explains why the builders want it at different moments.
      mark: { id: "preview", label: title, shapes: svgShapes, flipY: true },
      origin: "svg",
    };
  }

  return {
    // Typeface outlines are authored Y-up already.
    mark: { id: "preview", label: title, shapes: await initialShapes(title), flipY: false },
    origin: "initial",
  };
}

function shapesFromSvg(source: string): THREE.Shape[] | null {
  try {
    const shapes = svgToShapes(source);
    return shapes.length > 0 ? shapes : null;
  } catch {
    return null;
  }
}

async function initialShapes(title: string): Promise<THREE.Shape[]> {
  const { FontLoader } = await import("three/examples/jsm/loaders/FontLoader.js");
  const font = await new FontLoader().loadAsync(FONT_PATH);

  // `Array.from`, not `title[0]` — indexing a string cuts a surrogate pair in half, and the first
  // thing that would break on is an emoji in a project title.
  const initial = Array.from(title.trim())[0] ?? "?";
  const shapes = letterToShapes(initial.toUpperCase(), font);

  // A non-Latin title is a perfectly reasonable thing for an editor to publish, and helvetiker does
  // not have the glyph. The site draws a plain square in that case rather than crashing the section;
  // so does this, and for once being obviously a placeholder is the honest thing to show.
  return shapes.length > 0 ? shapes : [placeholderSquare()];
}

/** Matches the site's `LETTER_SOURCE_SIZE`; everything is normalised to a world size downstream. */
const PLACEHOLDER_SOURCE_SIZE = 100;

function placeholderSquare(): THREE.Shape {
  const half = PLACEHOLDER_SOURCE_SIZE / 2;
  const square = new Shape();

  square.moveTo(-half, -half);
  square.lineTo(half, -half);
  square.lineTo(half, half);
  square.lineTo(-half, half);
  square.closePath();

  return square;
}
