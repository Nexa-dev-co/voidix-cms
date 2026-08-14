/**
 * Everything both sides of a mark upload have to agree about: where the file goes, how big it may
 * be, and what counts as an SVG we are willing to store.
 *
 * ⚠ NO `node:` IMPORTS IN THIS FILE. The upload field is a Client Component and reads the size cap
 * and the content type from here, so anything Node-only would turn a shared constant into a build
 * error. That is why the path suffix comes from `crypto.randomUUID` — the Web Crypto global, which
 * both runtimes have — rather than from `node:crypto`.
 *
 * ── ⚠ THE SHAPE-COUNT CHECK IS NOT HERE, AND THAT IS DELIBERATE ─────────────────────────────────
 * The question that actually decides whether a file works as a mark — *does this SVG contain filled
 * geometry* — can only be answered by parsing it the way the site parses it, with three's
 * `SVGLoader`. That needs a DOM, Node has none, and adding jsdom to re-answer a question the
 * browser can answer exactly is not worth the dependency. So the split is:
 *
 *   the browser (MarkUploadField)  → is this USABLE     — exact, immediate, and fixable by the
 *                                                          person standing in front of it
 *   the server  (this file)        → is this SAFE       — authoritative, and cannot be bypassed
 *
 * A hostile caller skipping the browser check gets a file that is stored and then renders as
 * nothing on the site. A hostile caller skipping *this* one is the reason this one exists.
 */

/** The bucket, created by `20260814000000_project_marks`. Public read; see that migration for why. */
export const MARK_BUCKET = "marks";

/**
 * The two names the project form submits a mark under.
 *
 * They live here rather than in the field component because the server action reads them too, and a
 * server module importing a `"use client"` file to borrow a string is how a client component ends up
 * in the server graph. One isomorphic home, two readers.
 *
 * ⚠ `markSvgRemove` exists because an empty file input is not a message. It means "leave the mark
 * alone", and without a second name there is no way to spell "take it away".
 */
export const MARK_FILE_FIELD = "markSvgFile";
export const MARK_REMOVE_FIELD = "markSvgRemove";

/**
 * The ceiling on a mark, in bytes.
 *
 * Generous for the job — the three logos the site shipped with are 688, 1154 and 1455 bytes — and
 * deliberately not generous enough to matter. Every byte here is parsed and triangulated on the
 * visitor's main thread during the loading screen, so this is a budget on THEIR time, not on our
 * disk. It is also comfortably inside the 1 MB body limit a Next server action allows.
 */
export const MARK_MAX_BYTES = 256 * 1024;

export const MARK_CONTENT_TYPE = "image/svg+xml";

/**
 * Where a stored mark is readable from.
 *
 * ⚠ The SITE must be configured with this exact string as `VOIDIX_MARK_URL_PREFIX`, and it refuses
 * to fetch anything that does not start with it. That check is the whole defence against a payload
 * pointing the site's server at an arbitrary host, so the two values drifting apart does not fail
 * open — it fails to marks entirely, and every project falls back to its initial.
 */
export function markUrlPrefix(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be set to store project marks.");
  }

  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${MARK_BUCKET}/`;
}

export function markPublicUrl(storagePath: string): string {
  return `${markUrlPrefix()}${storagePath}`;
}

/**
 * A fresh object path for every upload, never a stable one per project.
 *
 * ⚠ Overwriting an object at a path that has already been served is how you get a mark that is
 * updated everywhere except on the CDN edge that cached the old bytes. A new path each time makes
 * the new file a new URL, so there is nothing to invalidate — and the old object is deleted by the
 * caller using `mark_storage_path`, which is the column that exists for exactly this.
 */
export function buildMarkStoragePath(projectSlug: string): string {
  return `${projectSlug}-${crypto.randomUUID().slice(0, 8)}.svg`;
}

/**
 * Why this SVG must not be stored, or `null` if there is no reason.
 *
 * Element-level, not a full parse. The site feeds this text to `SVGLoader.parse`, which builds
 * outlines and never puts a node in a document, so nothing below can execute *there*. It is caught
 * here because the file is also shown back to an admin, and because a file that carries a script is
 * not a logo whatever it renders as.
 */
export function describeUnsafeSvg(source: string): string | null {
  if (!/<svg[\s>]/i.test(source)) {
    return "That file does not contain an <svg> element.";
  }

  // Entities are the XXE and billion-laughs vector, and no drawing tool emits them.
  if (/<!ENTITY/i.test(source)) {
    return "That SVG declares XML entities, which we do not accept.";
  }

  if (/<script[\s>]/i.test(source) || /<foreignObject[\s>]/i.test(source)) {
    return "That SVG contains a script or embedded HTML. Export it as plain vector artwork.";
  }

  // `on…=` catches every inline handler in one rule rather than listing them.
  if (/\son[a-z]+\s*=/i.test(source)) {
    return "That SVG carries inline event handlers. Export it as plain vector artwork.";
  }

  // Anything that would make the mark depend on a second request — which the site cannot make, and
  // would not be allowed to make, at the point it parses this.
  if (/<image[\s>]/i.test(source)) {
    return "That SVG embeds a bitmap. The mark has to be vector outlines the whole way down.";
  }

  if (/(?:xlink:)?href\s*=\s*["']\s*(?:https?:)?\/\//i.test(source)) {
    return "That SVG references an external file. Everything has to be inside the one file.";
  }

  return null;
}
