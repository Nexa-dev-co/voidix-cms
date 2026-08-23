/**
 * Turning the journey layer's machine-facing strings into something a person can read.
 *
 * ── ⚠ EVERY FUNCTION HERE IS A FORMATTER, AND NONE OF THEM IS A LOOKUP TABLE ────────────────────
 * The temptation, looking at a dashboard full of `button.enquiry-cta`, is to write a map from every
 * known selector to a nice name. Do not: that is a second source of truth about the site's markup,
 * living in the other repository, with nothing to keep the two in step — the exact hazard
 * `contentPayload.ts` and `intakeSchema.ts` both carry warnings about. Rename a class on the site
 * and the row silently stops resolving, which looks like the element stopped being used.
 *
 * ⚠ The real fix for a name lives on the SITE, where the element is: `describeTarget` in
 * `orbix-dev/lib/journey/cursor.ts` prefers a `[data-journey]` attribute over the structural
 * fallback, so an element that wants a readable name says so beside itself and cannot drift from it.
 * What is here only has to make the FALLBACK legible — for elements nobody has labelled yet, and for
 * rows already in the table from before they were.
 */

/**
 * Words that a capitalised first letter gets wrong.
 *
 * ⚠ Matched on the whole word, never as a substring — `faq` must become `FAQ` while `crafts` must
 * not become `CRAFTs`. Deliberately tiny: it is here for initialisms the studio actually uses, and
 * anything longer is a sign somebody is trying to build the lookup table this file refuses to be.
 */
const INITIALISMS = new Set(["faq", "cta", "cv", "ai", "ui", "ux", "crm", "saas", "id", "url"]);

function capitaliseWord(word: string): string {
  if (INITIALISMS.has(word.toLowerCase())) return word.toUpperCase();
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * A section key, as a human should read it.
 *
 * ⚠ NOT A CSS `capitalize`, which is what this used to be. A document route's section key is a DOM
 * id doing double duty as a label — `the-studio`, `how-we-work` — and no text-transform turns a
 * hyphen into a space, so the raw id was reaching the page. The homepage's keys (`hero`, `work`)
 * happen to survive `capitalize` intact, which is exactly why the gap went unnoticed until the
 * document routes started reporting sections at all.
 *
 * ⚠ Only the FIRST word is capitalised, so `how-we-work` reads as a sentence rather than a Title.
 * The initialism set still applies throughout — `faq` is `FAQ` wherever it lands.
 */
export function humanise(key: string): string {
  const words = key.replace(/-/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return key;

  return words
    .map((word, index) =>
      index === 0 || INITIALISMS.has(word.toLowerCase()) ? capitaliseWord(word) : word,
    )
    .join(" ");
}

/** What `describeTarget` reports, split into something the UI can set in two weights. */
export interface TargetLabel {
  /** The name to read. Never a selector. */
  name: string;
  /** The kind of thing it was — `button`, `link` — or null when the name already says. */
  kind: string | null;
  /** True when the site named this element itself, rather than this file guessing from its markup. */
  isAuthored: boolean;
}

/**
 * ⚠ The two names `describeTarget` returns for "not a control", which are findings rather than
 * elements and would otherwise appear in the table as if they were things on the page.
 */
const NON_ELEMENT_TARGETS: Record<string, string> = {
  // The pointer was over the page but not over anything that could respond.
  surface: "Empty space",
  // There was no element under the pointer at all.
  none: "Nothing",
};

/** `input` and friends are worth naming; a generic `div` behind a role is not. */
const ELEMENT_KINDS: Record<string, string> = {
  a: "link",
  button: "button",
  input: "field",
  textarea: "field",
  select: "field",
};

/**
 * Read one `target` string from the journey layer.
 *
 * Three shapes arrive here, and they are distinguishable without any knowledge of the site:
 *
 *   `Send an enquiry`   an authored `[data-journey]` label — passed through untouched
 *   `button.enquiry-cta` the structural fallback — split into a name and a kind
 *   `surface` / `none`   not an element at all — named as the finding it is
 *
 * ⚠ The authored case is detected by the ABSENCE of a selector shape, not by a whitelist. A label
 * somebody adds to the site tomorrow has to work here today without this file being redeployed.
 */
export function describeTargetLabel(target: string): TargetLabel {
  const trimmed = target.trim();
  if (!trimmed) return { name: "Unknown", kind: null, isAuthored: false };

  const nonElement = NON_ELEMENT_TARGETS[trimmed];
  if (nonElement) return { name: nonElement, kind: null, isAuthored: false };

  // `tag.class` or a bare `tag` — the fallback `describeTarget` builds when nothing opted in.
  const structural = /^([a-z]+)(?:\.([A-Za-z0-9_-]+))?$/.exec(trimmed);
  if (structural) {
    const [, tag, className] = structural;
    const kind = ELEMENT_KINDS[tag] ?? tag;
    // A bare tag carries no name of its own, so the kind has to be the name.
    if (!className) return { name: capitaliseWord(kind), kind: null, isAuthored: false };
    return { name: humanise(className), kind, isAuthored: false };
  }

  return { name: trimmed, kind: null, isAuthored: true };
}

/**
 * A route, as the studio talks about it.
 *
 * ⚠ `/` rendered as a bare slash was a real defect in the heatmap headings — a single character
 * floating above a grid of cards, which reads as a stray glyph rather than as "this is the
 * homepage". Everything else is its own path humanised, so a route added tomorrow still reads.
 */
export function routeLabel(route: string): string {
  if (route === "/") return "Homepage";

  const segments = route.split("/").filter(Boolean);
  if (segments.length === 0) return route;

  return humanise(segments[segments.length - 1]);
}

/**
 * The site's own allocator grade, which is a word the site chose for itself and not a word anybody
 * else would guess the meaning of.
 *
 * ⚠ `potato` is not a joke here — it is the real key in `deviceTier.ts` and it is the tier that
 * decides whether a visitor gets any of the WebGL at all, so it has to appear. What it needs is the
 * consequence spelled out beside it, because that is the only reason this row is on the page.
 */
const DEVICE_TIER_LABELS: Record<string, { name: string; note: string }> = {
  potato: { name: "Potato", note: "Weakest — effects stripped back" },
  low: { name: "Low", note: "Runs it, with the budget tight" },
  mid: { name: "Mid", note: "The tier the site is tuned against" },
  high: { name: "High", note: "Full quality, room to spare" },
};

export function deviceTierLabel(tier: string): { name: string; note: string | null } {
  return DEVICE_TIER_LABELS[tier] ?? { name: humanise(tier), note: null };
}
