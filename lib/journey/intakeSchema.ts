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

/**
 * Must equal the site's `JOURNEY_SCHEMA_VERSION`.
 *
 * ⚠ v3 added `section`, `carousel` and `stopIndex` to the two cursor events; v4 added the viewport
 * shape to a cursor GRID. The event fields need no validation here — `.passthrough()` carries unknown
 * keys — but the grid is a modelled shape, so v4 is below. The check is an EQUALITY, so the two repos
 * must deploy together: a site on v4 against a panel on v3 has every batch rejected, silently.
 */
export const SUPPORTED_SCHEMA_VERSION = 5;

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
  /**
   * ⚠ ACTIVE time as of v5, not the wall clock the section was open for. The shape is unchanged, so
   * nothing here can detect the difference — the version is the only thing that can, which is why it
   * moved for a change that adds no field.
   */
  observedMs: z.number().int().nonnegative(),

  /**
   * The shape of the screen this grid was gathered on — v4.
   *
   * ⚠ OPTIONAL, EVEN THOUGH A v4 SITE ALWAYS SENDS THEM. The version check above already guarantees
   * the sender is v4, so these could be required — and requiring them would mean any future code path
   * that builds a grid without them takes the WHOLE BATCH down, events included. The cost of optional
   * is three nullable columns; the cost of required is a silent total loss. Take the columns.
   *
   * ⚠ Bounded. These are numbers from a browser the visitor controls, and they land in `Int` columns —
   * an absurd value is a failed insert that takes its transaction with it.
   */
  viewportWidth: z.number().int().positive().max(32_767).optional(),
  viewportHeight: z.number().int().positive().max(32_767).optional(),
  /**
   * ⚠ The SITE's answer, from the layout's own `em` media query — never re-derived from the width
   * above. `(max-width: 51.25em)` moves with the visitor's root font size, so a reader with large
   * text switches layout at a width that is not 820px, and only their browser knew that.
   */
  isNarrowLayout: z.boolean().optional(),
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
  /**
   * ⚠ THE BATCH OWNS THE SESSION ID — v2. It used to be read off `events[0]`, which held only
   * while a flush was a single body. The site splits a flush on BYTES, packing events first, so
   * every body after the first carries cursor payloads and no event at all; a client-side
   * navigation likewise flushes a lone grid with no event beside it. Both arrived unattributable
   * and every grid and path in them was dropped here, silently, behind a `console.warn`.
   */
  sessionId: z.string().uuid(),
  /**
   * ⚠ Optional, and its absence is what keeps `journey_cursor_paths.visitor_id` honest — a batch
   * with no consented visitor cannot store a path, because there is nothing to attribute it to.
   */
  visitorId: z.string().uuid().optional(),
  events: z.array(eventSchema).max(200),
  cursorGrids: z.array(cursorGridSchema).max(40).optional(),
  cursorPaths: z.array(cursorPathSchema).max(40).optional(),
});

export type JourneyBatchInput = z.infer<typeof journeyBatchSchema>;
export type JourneyEventInput = z.infer<typeof eventSchema>;
export type CursorGridInput = z.infer<typeof cursorGridSchema>;
export type CursorPathInput = z.infer<typeof cursorPathSchema>;
