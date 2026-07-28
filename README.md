# voidix-cms

The content control panel for the [voidix](https://github.com/Nexa-dev-co/orbix-dev) site.

It owns the **text** of three sections — Services, Works and FAQ — and nothing else. Models,
hull palettes, lighting, rock geometry and scene tuning stay in the site's source, where the
in-app `?tune` GUI writes them.

The site does **not** read from this database yet. Publishing works today: it snapshots the
copy into a release and records that the site was not rebuilt. Wiring the site up is a
separate task — see [Connecting the site](#connecting-the-site).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Prisma 7 · Supabase (Postgres + Auth)

## Setup

**1. Environment**

```bash
cp .env.example .env
```

Fill in from your Supabase project — Settings → Database for the two connection strings,
Settings → API for the URL and anon key. The two database URLs are not interchangeable:
`DATABASE_URL` is the pooled one the app runs on, `DIRECT_URL` is the direct one migrations
need.

**2. Database**

```bash
npm install
npm run db:deploy   # applies prisma/migrations — schema, then row-level security
npm run db:seed     # loads the copy currently live on the site
```

`db:seed` is idempotent — it upserts on slug, so re-running it will not duplicate anything.

**3. An admin user**

There is no public signup. Create the account in the Supabase dashboard:

Authentication → Users → **Add user** → *Create new user*, with **Auto Confirm User** ticked.

**4. Run it**

```bash
npm run dev
```

## How publishing works

The editing tables are a **draft**. Nothing you type reaches the site until you press Publish.

Publishing serialises the whole draft into one row in `content_releases` — an append-only log,
so every release stays inspectable and nothing is ever overwritten — and then pings the site
to rebuild. The overview compares draft against last release by value, so editing a field and
typing the original back leaves you with nothing to publish.

## What this panel deliberately cannot do

These are constraints in the site's code, not missing features:

- **Services cannot be added, reordered or deleted.** A service is a vessel: it needs a `.glb`,
  Draco compression, a hull palette, and placement tuned through `?tune`. Worse, the site's
  `deckTuning.ts` keys ship placements by *array position* and encodes that position inside
  `hiddenParts` strings like `"2:14"` — reorder or delete a service and every placement binds
  to the wrong vessel silently. Making this list mutable is a site-side refactor first: move
  placement onto the service record and key `hiddenParts` by slug.
- **New projects all look alike.** Rock geometry lives in the site's source. A project added
  here renders with the global fallback rock, so several text-only additions read as the same
  body repeated.
- **The Works heading is hardcoded.** `WorksField.tsx` says "Four fires." The panel warns you
  when the project count stops being four, but only a developer can change the heading.
- **Section headings and nav copy aren't here.** They're still hardcoded in JSX and have to be
  extracted into data files before a CMS can reach them.
- **No rich text.** Every string renders as plain text into a styled element. HTML is stripped
  on save; markdown is flagged in the editor rather than silently rewritten, because prose
  legitimately contains dashes and underscores.

## Connecting the site

When you're ready to have the site read from here:

1. Add a revalidate route to the site that rebuilds the three sections.
2. Set `SITE_REVALIDATE_URL` and `SITE_REVALIDATE_SECRET` in this app's environment.
3. Have the site read the newest `content_releases` row at build time and map `payload` onto
   its existing types. The payload is already shaped for them — services carry
   `index` / `name` / `eyebrow` / `description` / `capabilities`, and the fields the CMS
   doesn't own are simply absent, so the site keeps supplying `modelPath`, `profile`, `light`
   and `rock` from its own source.

Reading the release payload rather than the normalized tables is deliberate: one row, one
query, atomically consistent, and it can't catch the database mid-edit.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Generates the Prisma client, then builds |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Creates a migration from schema changes (development) |
| `npm run db:deploy` | Applies existing migrations (production / first setup) |
| `npm run db:seed` | Loads the site's current copy |
| `npm run db:studio` | Prisma Studio |
