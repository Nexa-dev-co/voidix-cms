-- Journey analytics — what visitors actually do on the site, in two tiers of consent.
--
-- The site's `lib/journey/events.ts` is the other half of this contract and NOTHING ENFORCES THE
-- PAIR. Same hazard as the content payload, same rule: change one, change the other in the same
-- sitting, and bump the schema version so a mismatch announces itself instead of arriving as a hole.
--
-- ── Two tables, opposite lifetimes ──────────────────────────────────────────────────────────────
--  * `journey_events`  the raw stream. High volume, DELETED after 90 days.
--  * `journey_daily`   the nightly rollup. Tiny, kept indefinitely.
--
-- That split is what makes "90 days" a survivable promise rather than a loss of history: the shape of
-- last year's traffic is still readable long after the individual rows are gone.
--
-- ⚠ NOTHING DELETES ANYTHING YET. This migration creates the tables; the retention sweep is a
-- scheduled job that does not exist at the time of writing. Until it does, the 90 days is a plan and
-- not a behaviour — and the site's privacy notice must not claim the period before the job runs.
--
-- ── ⚠ The privacy guarantee is `visitor_id IS NULL`, and it is structural ───────────────────────
-- Tier 1 is every visitor: no identifier, no device storage, nothing that can single anyone out. The
-- site does not generate an id at all unless consent was given, so a tier 1 row has nothing to join
-- on. That is a stronger promise than "we don't look" and it is the one the privacy notice makes.
-- Any future backfill of this column would break it.
--
-- `session_id` is not a loophole. It is generated per browser TAB, held only in memory, never written
-- to the device, and gone when the tab closes. It stitches one visit together; it recognises nobody.

-- ── The raw stream ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE "journey_events" (
    "id" UUID NOT NULL,
    -- A `JourneyEventName` from the site's taxonomy. Text rather than an enum deliberately: a site
    -- deployed ahead of a migration then records its new event instead of failing the whole batch.
    "name" VARCHAR(32) NOT NULL,

    -- ⚠ WHEN THE BROWSER SAYS IT HAPPENED, AND BROWSER CLOCKS LIE — wrong timezone, wrong date, or
    -- simply set by hand. Untrusted, and never to be used to bucket a report by day. It exists
    -- because it is the only thing that can order events WITHIN a session and give an honest dwell
    -- time, which `received_at` cannot: ten events flushed in one batch all arrive in the same
    -- millisecond.
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    -- ⚠ SERVER TRUTH. Every report groups by this.
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    "session_id" UUID NOT NULL,
    -- ⚠ Tier 2 only. NULL is the normal case and the privacy-preserving one.
    "visitor_id" UUID,
    -- 1 = anonymous, everyone. 2 = consented. Stored rather than inferred from `visitor_id` so the
    -- two can be checked against each other; if they ever disagree, that is a bug worth seeing.
    "tier" SMALLINT NOT NULL,

    -- The route only — no query string, no hash, nothing a visitor typed.
    "route" VARCHAR(64) NOT NULL,
    -- Promoted out of `detail` because the section funnel groups by it, and a JSON path would put the
    -- one hot query on the slow road. NULL for events belonging to no section.
    "section" VARCHAR(32),
    -- Everything else: depth, dwell_ms, stop_index, the device profile. Shapeless on purpose — the
    -- site's discriminated union is the schema, and mirroring fourteen shapes as columns here would
    -- mean a migration every time one of them gains a field.
    "detail" JSONB,

    "schema_version" SMALLINT NOT NULL,

    CONSTRAINT "journey_events_pkey" PRIMARY KEY ("id")
);

-- The retention sweep deletes by this, so it leads.
CREATE INDEX "journey_events_received_at_idx" ON "journey_events"("received_at");
-- Every funnel is "this event, over this window".
CREATE INDEX "journey_events_name_received_at_idx" ON "journey_events"("name", "received_at");
-- Stitching one visit back together.
CREATE INDEX "journey_events_session_id_idx" ON "journey_events"("session_id");
-- ⚠ Tier 2 is a minority of rows, so this would be better as a partial index
-- (`WHERE visitor_id IS NOT NULL`). Prisma cannot express that, and diverging from the schema here
-- would leave `prisma migrate` permanently wanting to "fix" it. If this table ever gets large enough
-- to care, replace it by hand and accept the drift knowingly.
CREATE INDEX "journey_events_visitor_id_idx" ON "journey_events"("visitor_id");

-- ── The nightly rollup ──────────────────────────────────────────────────────────────────────────
CREATE TABLE "journey_daily" (
    "id" UUID NOT NULL,
    -- The UTC day being summarised. DATE, not a timestamp: this is a bucket, not a moment.
    "day" DATE NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    -- ⚠ NOT NULL, UNLIKE THE RAW TABLE, AND THE DEFAULT IS THE WHOLE REASON.
    --
    -- This column is part of the unique key below, and Postgres treats NULLs in a UNIQUE index as
    -- DISTINCT FROM ONE ANOTHER. Nullable, `(2026-08-17, 'intro:start', NULL)` could be inserted
    -- twice: the job would add a second row per day per event forever, every count read off this
    -- table would be wrong, and no constraint would catch it. `''` means "belongs to no section".
    "section" VARCHAR(32) NOT NULL DEFAULT '',

    "event_count" INTEGER NOT NULL,
    -- Always <= event_count.
    "session_count" INTEGER NOT NULL,
    -- ⚠ NULL rather than 0 when there were no tier 2 events at all. "Nobody consented" and "nobody
    -- was measured" are different facts and a 0 conflates them.
    "visitor_count" INTEGER,
    -- Only meaningful for `stop:dwell`. MEDIAN, not mean: one tab left open overnight drags an
    -- average into fiction, and that is the normal case rather than the rare one.
    "median_dwell_ms" INTEGER,

    "built_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journey_daily_pkey" PRIMARY KEY ("id")
);

-- One row per day per event per section, so a re-run of the job updates rather than duplicates.
CREATE UNIQUE INDEX "journey_daily_day_name_section_key" ON "journey_daily"("day", "name", "section");
CREATE INDEX "journey_daily_day_idx" ON "journey_daily"("day");
