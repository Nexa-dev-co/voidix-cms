const MAX_SLUG_LENGTH = 64;

/**
 * A stable, url-safe identity derived from a title.
 *
 * Slugs exist so the site can eventually key off something that survives a reorder, instead
 * of the array position it uses today. They are never shown to a visitor, and they don't
 * follow a later rename — the point is that they don't move.
 */
export function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    // Strip combining marks so "Café" becomes "cafe" rather than "caf".
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");

  return slug.length > 0 ? slug : "untitled";
}

/**
 * Appends `-2`, `-3`… until the slug is free. Called inside the same transaction as the
 * insert would be better, but these lists are tiny and single-editor, so a check-then-write
 * is honest about the actual risk.
 */
export function makeSlugUnique(baseSlug: string, takenSlugs: Set<string>): string {
  if (!takenSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  while (takenSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}
