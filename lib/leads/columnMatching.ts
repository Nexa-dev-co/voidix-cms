import type { ImportFieldKey } from "@/lib/leads/spreadsheet";

/**
 * Header matching that survives real spreadsheets.
 *
 * The first version compared headers to an exact list, which failed the moment a file said
 * "Customer Name" instead of "Name" or "E-mail Address" instead of "Email" — i.e. almost
 * always. This scores instead:
 *
 *   1. Reduce the header to bare tokens ("E-mail Address" → ["email", "address"]).
 *   2. Score it against each field's keywords, strongest signal first.
 *   3. Assign the best column per field, never letting two fields claim the same column.
 *
 * Scoring beats a longer exact list because it degrades gracefully — an unseen header like
 * "Primary Contact Email" still matches on the "email" token.
 */

interface FieldMatcher {
  /** A header equal to one of these is certainly this field. */
  exact: string[];
  /** A token appearing anywhere in the header is a strong signal. */
  strong: string[];
  /** Weaker supporting signal, only decisive when nothing stronger matched. */
  weak: string[];
  /** Tokens that rule the field out even if something else matched. */
  exclude: string[];
}

const MATCHERS: Record<ImportFieldKey, FieldMatcher> = {
  email: {
    exact: ["email", "e mail", "mail", "email address", "e mail address"],
    strong: ["email", "mail"],
    weak: [],
    // "mailing address" is a postal address, not an email.
    exclude: ["mailing", "postal"],
  },
  name: {
    exact: [
      "name",
      "full name",
      "customer name",
      "contact name",
      "client name",
      "person",
      "lead name",
    ],
    strong: ["name", "contact", "person", "customer", "client"],
    weak: ["first", "given"],
    // Anything that is some *other* thing's name.
    exclude: ["company", "organisation", "organization", "business", "account", "file", "user"],
  },
  company: {
    exact: [
      "company",
      "organisation",
      "organization",
      "company name",
      "organisation name",
      "organization name",
      "business",
      "account",
      "employer",
    ],
    strong: ["company", "organisation", "organization", "business", "employer"],
    weak: ["account", "org", "firm"],
    exclude: [],
  },
  phone: {
    exact: [
      "phone",
      "telephone",
      "mobile",
      "phone number",
      "mobile number",
      "tel",
      "cell",
      "contact number",
    ],
    strong: ["phone", "mobile", "telephone", "tel", "cell", "whatsapp"],
    weak: ["number"],
    exclude: ["fax", "account"],
  },
  message: {
    exact: [
      "message",
      "notes",
      "note",
      "additional notes",
      "comment",
      "comments",
      "enquiry",
      "inquiry",
      "details",
    ],
    strong: ["message", "note", "notes", "comment", "comments", "enquiry", "inquiry", "remark"],
    weak: ["detail", "details", "description", "info"],
    exclude: [],
  },
};

const EXACT_SCORE = 100;
const STRONG_SCORE = 50;
const WEAK_SCORE = 10;
const MINIMUM_SCORE = WEAK_SCORE;

/** Lowercases and reduces any punctuation or separator to single spaces. */
export function normaliseHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreHeader(header: string, matcher: FieldMatcher): number {
  const normalised = normaliseHeader(header);

  if (normalised.length === 0) {
    return 0;
  }

  const tokens = new Set(normalised.split(" "));

  if (matcher.exclude.some((token) => tokens.has(token))) {
    return 0;
  }

  if (matcher.exact.includes(normalised)) {
    return EXACT_SCORE;
  }

  let score = 0;
  if (matcher.strong.some((token) => tokens.has(token))) {
    score += STRONG_SCORE;
  }
  if (matcher.weak.some((token) => tokens.has(token))) {
    score += WEAK_SCORE;
  }

  return score;
}

/**
 * Best-guess column for each field.
 *
 * Fields are resolved strongest-match-first across the whole grid rather than in a fixed
 * order, so a header that two fields both want goes to whichever wants it more — "Contact
 * Number" reads as phone, not as name, because phone scores it higher.
 */
export function matchColumns(headers: string[]): Record<ImportFieldKey, number | null> {
  const fieldKeys = Object.keys(MATCHERS) as ImportFieldKey[];

  const candidates: { field: ImportFieldKey; columnIndex: number; score: number }[] = [];

  for (const field of fieldKeys) {
    headers.forEach((header, columnIndex) => {
      const score = scoreHeader(header, MATCHERS[field]);
      if (score >= MINIMUM_SCORE) {
        candidates.push({ field, columnIndex, score });
      }
    });
  }

  candidates.sort((left, right) => right.score - left.score);

  const mapping = Object.fromEntries(fieldKeys.map((field) => [field, null])) as Record<
    ImportFieldKey,
    number | null
  >;
  const claimedColumns = new Set<number>();

  for (const candidate of candidates) {
    if (mapping[candidate.field] !== null || claimedColumns.has(candidate.columnIndex)) {
      continue;
    }

    mapping[candidate.field] = candidate.columnIndex;
    claimedColumns.add(candidate.columnIndex);
  }

  return mapping;
}
