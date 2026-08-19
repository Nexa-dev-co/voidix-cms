import { z } from "zod";

/**
 * The site's journey batch, validated.
 *
 * ── ⚠ THIS MIRRORS `orbix-dev/lib/journey/events.ts` AND NOTHING ENFORCES THE PAIR ──────────────
 * Two repositories, one JSON document, no shared package — the same hazard `contentPayload.ts`
 * already carries, with the same rule: change one, change the other in the same sitting. The failure
 * mode here is quieter than the content one, because a rejected batch is invisible to the visitor and
 * to the site (which deliberately ignores the response). Watch the panel's log, not the site's.
 *
 * ⚠ `JOURNEY_SCHEMA_VERSION` is checked rather than ignored. A site deployed ahead of this panel will
 * send a shape this file does not know, and storing a half-understood analytics row is worse than
 * dropping it — a partial row still looks like data and will be counted by something later.
 */

/** Must equal the site's `JOURNEY_SCHEMA_VERSION`. */
export const SUPPORTED_SCHEMA_VERSION = 1;

/**
 * ⚠ Must equal `CURSOR_GRID_COLUMNS` / `CURSOR_GRID_ROWS` in the site's `lib/journey/events.ts`.
 *
 * The cell index stored in `journey_cursor_grids.cells` is `row * columns + column`, so the panel
 * cannot decode a single heatmap without knowing the same two numbers. Change one side and every
 * heatmap silently renders as diagonal streaks rather than failing — which is the kind of wrong that
 * looks like data.
 */
export const CURSOR_GRID_COLUMNS = 32;
export const CURSOR_GRID_ROWS = 18;

/**
 * ⚠ Deliberately a plain string rather than an enum of the seventeen names.
 *
 * An enum would reject an event the site started sending before this panel was redeployed — and the
 * whole batch with it, including the events this side does understand. A `VarChar(32)` and an unknown
 * name in the table is a strictly better outcome than a dropped batch: the dashboard ignores names it
 * has no query for, and the row is there when somebody comes looking.
 */
const eventNameSchema = z.string().min(1).max(32);

const eventSchema = z
  .object({
    name: eventNameSchema,
    occurredAt: z.number().int().positive(),
    sessionId: z.string().uuid(),
    // ⚠ Optional, and its ABSENCE is the tier 1 guarantee. See the route for why a present
    // `visitorId` on a `tier: 1` event is treated as a malformed batch rather than tidied up.
    visitorId: z.string().uuid().optional(),
    tier: z.union([z.literal(1), z.literal(2)]),
    route: z.string().max(64),
  })
  // Every event carries its own extra fields — `depth`, `dwellMs`, `deviceTier`, and so on. They are
  // stored as JSON rather than modelled here, so unknown keys are kept rather than stripped.
  .passthrough();

const cursorGridSchema = z.object({
  route: z.string().max(64),
  section: z.string().min(1).max(32),
  // Sparse map of cell index → count. Keys arrive as strings because that is what JSON objects are.
  cells: z.record(z.string(), z.number().int().nonnegative()),
  observedMs: z.number().int().nonnegative(),
});

const cursorPathSchema = z.object({
  route: z.string().max(64),
  section: z.string().min(1).max(32),
  // ⚠ Capped. A path is delta-encoded in triples, so this is 5,000 points — the site's own ceiling,
  // restated here because the site's check runs in a browser the visitor controls.
  points: z.array(z.number().int()).max(15_000),
  sampleHz: z.number().int().positive().max(120),
});

export const journeyBatchSchema = z.object({
  schemaVersion: z.number().int(),
  events: z.array(eventSchema).max(200),
  cursorGrids: z.array(cursorGridSchema).max(40).optional(),
  cursorPaths: z.array(cursorPathSchema).max(40).optional(),
});

export type JourneyBatchInput = z.infer<typeof journeyBatchSchema>;
export type JourneyEventInput = z.infer<typeof eventSchema>;
export type CursorGridInput = z.infer<typeof cursorGridSchema>;
export type CursorPathInput = z.infer<typeof cursorPathSchema>;
