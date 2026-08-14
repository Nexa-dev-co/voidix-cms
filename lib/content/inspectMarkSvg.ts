import { describeUnsafeSvg, MARK_MAX_BYTES } from "@/lib/content/markStorage";

/**
 * Is this SVG usable as a works mark?
 *
 * ── ⚠ THIS RUNS IN THE BROWSER, AND IT HAS TO ───────────────────────────────────────────────────
 * It answers the question by parsing the file with the SAME loader the site parses it with, which
 * needs a DOM. Node has no `DOMParser`, so this cannot move to a server action — and it should not:
 * an approximation of a different engine that says "looks fine" while the site disagrees is worse
 * than no check, because it produces a wrong mark with a green tick next to it.
 *
 * `three` is a dependency of this panel for this one function. It is imported dynamically so the
 * weight lands only when an admin actually picks a file.
 *
 * ── ⚠ THE TRAP THIS EXISTS FOR IS NOT "EMPTY", IT IS "STROKE-ONLY" ──────────────────────────────
 * `SVGLoader.parseNode` pushes every geometry element onto `paths` whatever its fill — `fill: none`
 * only skips setting a colour — and the parse is seeded with `fill: '#000'`, so `style.fill` is
 * never undefined. The site's `svgToShapes` then triangulates each path as a filled outline.
 *
 * So a stroke-only icon — an outlined circle, say — does NOT come out empty. It comes out as a
 * SOLID DISC: the outline filled in. Nothing errors, no fallback fires, and the section shows a
 * blob where a logo should be. That is why the test below is not `paths.length > 0` but *is at
 * least one path actually filled*, and why the site skips `fill: none` paths to match.
 *
 * ⚠ Paired with `svgToShapes` in `orbix-dev/components/sections/WorksField/markBody.ts`. Two repos,
 * one rule, nothing enforcing it — if the fill rule changes there, change it here in the same
 * sitting or this panel starts approving files the site cannot draw.
 */

export interface MarkSvgInspection {
  /** Safe to store AND the site will draw something. */
  ok: boolean;
  /** What the site's cutter will receive. Shown to the editor as reassurance, not as a limit. */
  shapeCount: number;
  /** Null when `ok`. Written for the person who has to fix it, not for a log. */
  reason: string | null;
}

function refuse(reason: string): MarkSvgInspection {
  return { ok: false, shapeCount: 0, reason };
}

export async function inspectMarkSvg(source: string): Promise<MarkSvgInspection> {
  // Bytes, not characters — a multi-byte glyph counts as what it costs to send.
  if (new Blob([source]).size > MARK_MAX_BYTES) {
    return refuse(`That file is over the ${Math.round(MARK_MAX_BYTES / 1024)} KB limit.`);
  }

  const unsafe = describeUnsafeSvg(source);
  if (unsafe) {
    return refuse(unsafe);
  }

  const { SVGLoader } = await import("three/examples/jsm/loaders/SVGLoader.js");

  let parsed;
  try {
    parsed = new SVGLoader().parse(source);
  } catch {
    return refuse("That file could not be parsed as an SVG.");
  }

  if (parsed.paths.length === 0) {
    return refuse("That SVG has no drawable shapes in it — only text, or nothing at all.");
  }

  // `userData` is typed loosely by three; narrowed to the one thing read rather than trusted whole.
  const filledPaths = parsed.paths.filter((path) => {
    const style = (path.userData as { style?: { fill?: string } } | undefined)?.style;
    return style?.fill !== undefined && style.fill !== "none";
  });

  if (filledPaths.length === 0) {
    return refuse(
      "That SVG is drawn with strokes and no fills, so the mark would come out as a solid blob. " +
        "Outline the strokes and export it again.",
    );
  }

  const shapeCount = filledPaths.reduce(
    (total, path) => total + SVGLoader.createShapes(path).length,
    0,
  );

  if (shapeCount === 0) {
    return refuse("That SVG has fills but no closed shapes the mark can be cut from.");
  }

  return { ok: true, shapeCount, reason: null };
}
