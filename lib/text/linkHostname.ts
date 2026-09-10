/**
 * An absolute URL reduced to the domain a reader recognises: `https://www.aphelion.com/work` becomes
 * `aphelion.com`.
 *
 * Used by the works overview so an editor can see at a glance which projects link out, without
 * opening each one and without a full URL wrapping across three lines of a dense list.
 *
 * ⚠ This mirrors `displayHostname` in the SITE repo (`lib/displayHostname.ts`), which is what the
 * visitor actually sees. It is duplicated rather than shared for the same reason every other value
 * on this boundary is: there is no shared package between the two repositories. Nothing enforces
 * that they agree — but nothing needs to, because this copy only ever labels a row in the panel. If
 * they ever drift, the site's copy is the one that is right by definition.
 */
export function linkHostname(url: string): string {
  const trimmed = url.trim();

  if (trimmed.length === 0) {
    return "";
  }

  // `URL` throws rather than returning null, and this value is editor-supplied — so the parse is the
  // branch. It should always succeed: the schema refuses anything without an `http(s)` scheme.
  try {
    return new URL(trimmed).hostname.replace(/^www\./i, "");
  } catch {
    return trimmed;
  }
}
