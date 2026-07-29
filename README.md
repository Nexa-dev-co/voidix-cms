# voidix-cms

The content control panel for the [voidix](https://github.com/Nexa-dev-co/orbix-dev) site.

It owns the **text** of five sections — Services, Works, FAQ, Contact and Footer — plus the
inbox of leads the contact form produces. Models, hull palettes, lighting, rock geometry and
scene tuning stay in the site's source, where the in-app `?tune` GUI writes them.

Contact and Footer are built ahead of the site: neither section exists in `orbix-dev` yet, so
their copy is stored and publishable but has nothing rendering it.

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

**3. The first admin**

There is no public signup. Create the first account in the Supabase dashboard (Authentication
→ Users → **Add user**, with **Auto Confirm User** ticked), then grant it admin:

```bash
npm run db:bootstrap-admin
```

Everyone after that is added from the Team page inside the panel, which creates their login
for you.

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
  extracted into data files before a CMS can reach them. Contact and Footer are the exception —
  their copy lives here already, waiting for the sections to be built.
- **No rich text.** Every string renders as plain text into a styled element. HTML is stripped
  on save; markdown is flagged in the editor rather than silently rewritten, because prose
  legitimately contains dashes and underscores.

## Roles

Two roles, held in `team_members` rather than in Supabase Auth:

| | Site copy | Publish | Leads | Team | Settings |
| --- | --- | --- | --- | --- | --- |
| **Admin** | ✓ | ✓ | all, incl. delete | ✓ | ✓ |
| **Sales** | — | — | **only their own** | — | — |

Sales see strictly the leads assigned to them — not the team's, and not the unassigned pool
unless an admin opens that up under Settings. This is enforced in one place,
`lib/leads/visibility.ts`, which every list, count and detail lookup goes through; a query
that forgot the filter is exactly how one salesperson ends up reading another's pipeline.
The detail page re-checks per contact, because a URL is guessable and a direct visit never
touches the list.

Add people under **Team**. That one form creates their Supabase Auth login *and* their
permissions, and hands back a one-time password to pass on — no visit to the Supabase
dashboard required. You can also issue a fresh password, deactivate, or remove someone
(which deletes their login; leads they owned become unassigned rather than being deleted).

Under the hood the two halves stay separate: Supabase Auth owns the credential, `team_members`
owns the role, matched by email. **An Auth account with no team row can sign in but sees
nothing**, which is the safe default if an account is ever created outside this panel.

Creating logins needs `SUPABASE_SERVICE_ROLE_KEY` in `.env`. That key bypasses RLS entirely,
so it is confined to `lib/supabase/admin.ts`, which is marked `server-only` — importing it
from a Client Component is a build error rather than a silent leak into the browser bundle.

Sales users are blocked from content by the `(content)` route group's layout *and* by
`requireAdmin()` inside every content Server Action. Hiding the nav links is presentation
only; actions are reachable by direct POST, so each one checks for itself.

To grant the first admin (chicken-and-egg — you need an admin to make an admin):

```bash
npm run db:bootstrap-admin
```

It promotes any existing Auth user with no team row to ADMIN, and leaves anyone who already
has a row untouched.

## Leads

One row per **person** (`contacts`), with every touchpoint under them (`enquiries`).

That split is the whole design. A flat lead table conflates "a person" with "an approach they
made", which is why duplicates are hard to define in one: someone enquiring twice isn't a
duplicate of anything. Here the second enquiry attaches to the existing person, so nothing is
skipped, no data is lost, and **two salespeople can't end up owning two rows for one human**.

Leads arrive three ways — the website form, `Add lead`, and a spreadsheet import — and all
three follow the same rule: a known email never creates a second record.

### Attempts

Reaching *out* is recorded separately from them reaching *in*. An attempt logs who tried,
when, through which channel, how it went, and an optional note — so "has anyone chased this?"
has an answer. **A salesperson sees only their own attempts** on a lead unless an admin turns
that off in Settings. Channels and outcomes are editable vocabulary; attempts store the chosen
label as text, so renaming an outcome never rewrites what someone recorded last month.

### Importing a spreadsheet

`.xlsx` or `.csv`, first sheet, first row as headers, 5MB max (row limit is configurable in
Settings).

Column detection **scores** headers rather than matching a fixed list, so real-world names
like `Customer Name`, `E-mail Address`, `Organisation Name` and `Mobile Number` all resolve.
A few real values from each column are shown under its dropdown, because headers lie and
values don't.

Rows are cleaned as they're planned: a blank name becomes a readable guess from the address
(`julia@example.com` → "Julia", not the raw address), and a phone with no plausible digits in
it is dropped with a warning rather than stored as something nobody can dial.

The preview is generated by the same code that performs the import, so it can't drift from
what actually happens. Every row is classified as **new**, **already here**, **repeat in
file** (first occurrence wins) or **rejected**, and nothing is written until you confirm.

For rows that match someone already in the system you choose per row — or set them all at
once — between:

- **Fill blanks** — adds to history, fills only empty fields (the default)
- **History only** — adds to history, changes nothing else
- **Overwrite** — adds to history, replaces name/company/phone
- **Ignore** — does nothing at all

The commit step re-plans from the submitted rows rather than trusting a plan posted back from
the browser, since the client could have altered it and the database may have moved on.

Admins get a final step deciding who the new leads belong to: leave unassigned, all to one
person, or split evenly across the people they tick — with the distribution shown before
committing. It applies to newly created contacts only; an import never reassigns a lead
someone already owns. A salesperson importing a list gets it themselves, because their own
name is the only owner they may set.

### Settings

Admin-only, at `/admin/settings`:

- **New website leads** — leave unassigned, round-robin across active sales, or always one
  named person. The round-robin pointer is stored, so the rotation survives restarts and
  works on serverless where there is no process memory.
- **What Sales can do** — edit contact details, see and claim unassigned leads, export, and
  see other people's attempts. All the widening ones default to off.
- **Imports** — default action for rows that already exist, max rows per import, and whether
  imports may overwrite existing details at all. Turning overwrite off removes it from the
  preview *and* rejects it server-side, since the form is a POST endpoint.
- **Attempt vocabulary** — the channel and outcome lists. Entries are retired rather than
  deleted, so a word can come back without being re-created.

### The intake endpoint

`POST /api/leads` is the only route in this app reachable without logging in. Everything else
sits behind the session guard in `proxy.ts`; this one is exempt and does its own checks.

It **fails closed**: with no `LEADS_INTAKE_SECRET` set it rejects every request, so a
half-configured endpoint is shut rather than open. Once configured it checks, in order: a
constant-time secret comparison, an optional origin allowlist, a honeypot field, and a
per-IP-hash rate limit. Submissions are validated and stripped of HTML by the same code path
as the rest of the CMS, and are never rendered as markup.

The site should call it **from its own server**, not from the browser:

```ts
await fetch("https://<cms-host>/api/leads", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-voidix-secret": process.env.VOIDIX_CMS_SECRET,
  },
  body: JSON.stringify({ name, email, company, message, website: "" }),
});
```

`website` is the honeypot — the site's form must render it hidden and leave it empty. If the
form posts straight from the browser instead, the secret ships to every visitor and the origin
check, rate limit and honeypot become your only real defences.

Leads are not content. They're never part of a release, never published, and deleting one is a
real delete rather than a hidden flag — which is what you want when someone asks to be erased.
Deleting a contact takes their whole history with it, so it's admin-only; archiving is the
everyday "get this off my list" and every role can do it. Raw IP addresses are never stored,
only a salted hash used for rate limiting.

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
| `npm run db:bootstrap-admin` | Promotes existing Auth users with no team row to ADMIN |
| `npm run db:studio` | Prisma Studio |
