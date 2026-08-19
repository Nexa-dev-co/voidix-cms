-- Cursor tracking — where the pointer went, in two forms with two very different standings.
--
-- ── ⚠ WHY THIS IS NOT COLUMNS ON `journey_events` ───────────────────────────────────────────────
-- `mousemove` fires at 60–120 Hz. A row per sample is roughly 600 rows per minute per visitor against
-- an events table that holds about fifteen rows for an entire visit — at a thousand visits a month
-- that is 2.4 million rows instead of four thousand, under a 90-day retention promise.
--
-- So movement is never an event. The browser accumulates in memory and posts ONE summary when it
-- leaves a section, and these two tables hold summaries rather than streams. A path is not fifteen
-- hundred events; it is one object about one span of time, and it belongs in its own row.
--
-- ── ⚠ THE TWO TABLES ARE NOT THE SAME KIND OF DATA, AND MUST NOT BE MERGED ──────────────────────
-- `journey_cursor_grids` is a HISTOGRAM: counts per cell, no ordering, no path, no precision. Two
-- people who moved completely differently but rested in the same places produce identical rows. That
-- is what makes it collectable from everyone without asking.
--
-- `journey_cursor_paths` is the actual trail, and it is SESSION REPLAY IN ALL BUT NAME. Mouse
-- dynamics — velocity, tremor, the shape of a correction — are an established behavioural biometric,
-- so a path can identify a person in a way nothing else in this database can. It exists only where
-- consent exists, which is why `visitor_id` is NOT NULL here and nullable everywhere else: a null
-- would be a path nobody agreed to.
--
-- ⚠ WITHDRAWING CONSENT MUST DELETE FROM `journey_cursor_paths`. Nothing else in this schema has that
-- obligation, because nothing else in it is capable of identifying somebody. The `visitor_id` index
-- exists so that deletion is one indexed statement rather than a table scan.
--
-- ⚠ `section` IS NOT NULLABLE IN EITHER TABLE. The site's homepage is ONE pinned viewport that four
-- WebGL scenes take turns occupying, so a heatmap of "the page" is four scenes smeared on top of one
-- another and means nothing at all. Every row is anchored to the scene it was gathered in.

-- ── Tier 1: everybody. A histogram, not a trail. ────────────────────────────────────────────────
CREATE TABLE "journey_cursor_grids" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "route" VARCHAR(64) NOT NULL,
    "section" VARCHAR(32) NOT NULL,
    -- Sparse map of cell index → sample count, over a 32×18 grid normalised to the VIEWPORT (not the
    -- document — on `/` there is no document to speak of). Most cells are empty in any one section.
    "cells" JSONB NOT NULL,
    -- The denominator. Without it a long visit simply looks hot everywhere.
    "observed_ms" INTEGER NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journey_cursor_grids_pkey" PRIMARY KEY ("id")
);

-- The retention sweep deletes by this.
CREATE INDEX "journey_cursor_grids_received_at_idx" ON "journey_cursor_grids"("received_at");
-- The heatmap query: one section, over one window.
CREATE INDEX "journey_cursor_grids_route_section_received_at_idx" ON "journey_cursor_grids"("route", "section", "received_at");

-- ── Tier 2: consented only. The trail itself. ───────────────────────────────────────────────────
CREATE TABLE "journey_cursor_paths" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    -- ⚠ NOT NULL, unlike every other visitor_id in this database. See the header: this row may not
    -- exist without the consent that produced it.
    "visitor_id" UUID NOT NULL,
    "route" VARCHAR(64) NOT NULL,
    "section" VARCHAR(32) NOT NULL,
    -- Delta-encoded and quantised: [t, x, y, dt, dx, dy, …], absolute for the first point only.
    -- Positions are per-thousand of the viewport rather than pixels, so a path means the same thing
    -- on two different monitors and carries nothing about the screen that `device:profile` has not
    -- already recorded openly.
    "points" JSONB NOT NULL,
    "sample_hz" SMALLINT NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journey_cursor_paths_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "journey_cursor_paths_received_at_idx" ON "journey_cursor_paths"("received_at");
CREATE INDEX "journey_cursor_paths_route_section_received_at_idx" ON "journey_cursor_paths"("route", "section", "received_at");
-- ⚠ Erasing everything belonging to one withdrawn visitor has to be one indexed statement.
CREATE INDEX "journey_cursor_paths_visitor_id_idx" ON "journey_cursor_paths"("visitor_id");
