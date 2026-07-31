import { EnquirySource } from "@/generated/prisma/enums";

/**
 * How a lead got into the system: the words for it, the shape written when one is created, and
 * the shape read back out.
 *
 * All three live together on purpose. There are three routes that create a contact — the website
 * form, the manual add, and the importer — and each of them used to leave no trace of itself
 * beyond an enquiry row. Spreading "what counts as the origin" across those three files is how
 * they end up disagreeing about it.
 *
 * Deliberately free of any database import, so the table's filter dropdown can use the same
 * vocabulary the server writes with.
 */

/** The channel, short enough for a table cell. */
export const ORIGIN_LABELS: Record<EnquirySource, string> = {
  [EnquirySource.CONTACT_FORM]: "Website form",
  [EnquirySource.MANUAL]: "By hand",
  [EnquirySource.IMPORT]: "Imported",
};

/** The same thing as a sentence, for the lead's own page where there is room for one. */
export const ORIGIN_SENTENCES: Record<EnquirySource, string> = {
  [EnquirySource.CONTACT_FORM]: "Came in through the website form",
  [EnquirySource.MANUAL]: "Added by hand",
  [EnquirySource.IMPORT]: "Imported from a spreadsheet",
};

/** Ordered for the filter dropdown — inbound first, because that is the one people look for. */
export const ORIGIN_CHANNELS: EnquirySource[] = [
  EnquirySource.CONTACT_FORM,
  EnquirySource.MANUAL,
  EnquirySource.IMPORT,
];

/** The colour of the channel tag, keyed the way `STAGE_TONE` is. */
export const ORIGIN_TONES: Record<EnquirySource, string> = {
  // Inbound interest is the one worth spotting across a page of rows, so it gets the accent.
  [EnquirySource.CONTACT_FORM]: "border-accent/40 bg-accent/5 text-accent",
  [EnquirySource.MANUAL]: "border-border-strong text-muted",
  [EnquirySource.IMPORT]: "border-border-strong text-muted",
};

interface OriginMember {
  id: string;
  name: string;
}

/**
 * What a creating route says about itself.
 *
 * A union rather than five optional arguments, so the impossible combinations cannot be
 * expressed: an imported lead always has a batch, a hand-added one always has a person, and a
 * website lead has neither.
 */
export type LeadOrigin =
  | { via: "CONTACT_FORM"; label: string | null }
  | { via: "MANUAL"; member: OriginMember }
  | { via: "IMPORT"; member: OriginMember; batchId: string };

/** The columns to write. Spread straight into a `contact.create`. */
export interface OriginColumns {
  originSource: EnquirySource;
  originMemberId: string | null;
  originMemberName: string | null;
  originBatchId: string | null;
  originLabel: string | null;
}

export function originColumns(origin: LeadOrigin): OriginColumns {
  switch (origin.via) {
    case "CONTACT_FORM":
      return {
        originSource: EnquirySource.CONTACT_FORM,
        originMemberId: null,
        originMemberName: null,
        originBatchId: null,
        // Trimmed to nothing counts as nothing — an empty label would render as a stray separator.
        originLabel: origin.label && origin.label.trim().length > 0 ? origin.label.trim() : null,
      };

    case "MANUAL":
      return {
        originSource: EnquirySource.MANUAL,
        originMemberId: origin.member.id,
        originMemberName: origin.member.name,
        originBatchId: null,
        originLabel: null,
      };

    case "IMPORT":
      return {
        originSource: EnquirySource.IMPORT,
        originMemberId: origin.member.id,
        originMemberName: origin.member.name,
        originBatchId: origin.batchId,
        originLabel: null,
      };
  }
}

/** Everything stored about an origin, in the shape a screen renders. */
export interface OriginSummary {
  channel: EnquirySource;
  /** "Website form", "By hand", "Imported". */
  label: string;
  /** The spreadsheet it arrived in, or the campaign the site tagged it with. */
  detail: string | null;
  /** Who put them here. Null for the website form, where nobody did. */
  addedBy: string | null;
}

export function summariseOrigin(contact: {
  originSource: EnquirySource;
  originMemberName: string | null;
  originLabel: string | null;
  originBatch: { filename: string } | null;
}): OriginSummary {
  return {
    channel: contact.originSource,
    label: ORIGIN_LABELS[contact.originSource],
    // Only one of the two is ever set — the batch belongs to an import, the label to the form —
    // so this reads as "whichever detail this channel carries".
    detail: contact.originBatch?.filename ?? contact.originLabel,
    addedBy: contact.originMemberName,
  };
}

/** The full phrasing for the lead's own page: "Imported from q3.xlsx by Sara Khaled". */
export function describeOrigin(summary: OriginSummary): string {
  const parts = [ORIGIN_SENTENCES[summary.channel]];

  if (summary.detail) {
    parts.push(summary.channel === EnquirySource.IMPORT ? `(${summary.detail})` : `— ${summary.detail}`);
  }

  if (summary.addedBy) {
    parts.push(`by ${summary.addedBy}`);
  }

  return parts.join(" ");
}

/* ------------------------------------------------------------------ the filter --------- */

export const ANY_SOURCE = "any";
/** Marks a filter value as naming one spreadsheet rather than a whole channel. */
export const BATCH_FILTER_PREFIX = "batch:";

/**
 * Ids reach this from the query string, and a malformed one would be handed straight to a `uuid`
 * column — which Prisma rejects by throwing, turning a mistyped URL into a broken page.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SourceFilter =
  | { kind: "any" }
  | { kind: "channel"; channel: EnquirySource }
  | { kind: "batch"; batchId: string };

export function batchFilterValue(batchId: string): string {
  return `${BATCH_FILTER_PREFIX}${batchId}`;
}

/** Anything unrecognised falls back to "any" rather than to an empty list. */
export function parseSourceFilter(raw: string): SourceFilter {
  if (raw.startsWith(BATCH_FILTER_PREFIX)) {
    const batchId = raw.slice(BATCH_FILTER_PREFIX.length);

    return UUID_PATTERN.test(batchId) ? { kind: "batch", batchId } : { kind: "any" };
  }

  return ORIGIN_CHANNELS.includes(raw as EnquirySource)
    ? { kind: "channel", channel: raw as EnquirySource }
    : { kind: "any" };
}

/** The value to keep in the URL, with junk normalised away so links stay clean. */
export function normaliseSourceParam(raw: string): string {
  const parsed = parseSourceFilter(raw);

  switch (parsed.kind) {
    case "channel":
      return parsed.channel;
    case "batch":
      return batchFilterValue(parsed.batchId);
    case "any":
      return ANY_SOURCE;
  }
}
