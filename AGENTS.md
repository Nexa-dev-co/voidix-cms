<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# voidix-cms

Content control panel for the voidix site (`../orbix-dev`, repo `Nexa-dev-co/orbix-dev`). It
edits **text only** — five homepage sections, Services / Works / FAQ / Contact / Footer, plus the
two document pages, About and Careers — and a leads inbox. See `README.md` for what it
deliberately cannot do and why.

All seven now exist on the site. `careersContent.ts` names this panel as where its roles are
meant to come from.

**Contact and Footer were designed before their sections were built, and both guessed wrong.**
Reshaped in `20260812000001` once the real sections landed: Contact lost a two-line title (the
site renders one string), an eyebrow, a standalone email address and six form strings; Footer's
flat social/legal split became titled groups. Nothing was saved or published yet, so it cost
nothing — which is the whole reason to do it the moment the divergence is visible rather than
after the first release. **Do not model a section this panel cannot yet read.**

**`docs/PROJECT.md` records why the system is shaped the way it is** — the decisions, the
defects already hit and their causes, and the invariants worth protecting. Read it before any
structural change; it will save you re-deriving reasoning that is already written down.

## Versions that differ from training data

Check before writing, don't assume:

- **Next 16** — `middleware.ts` is now `proxy.ts` (Node runtime only, no edge). `params`,
  `searchParams`, `cookies()` and `headers()` are async with no sync fallback. Turbopack is
  the default for dev and build. `next lint` is gone; run `eslint` directly. `revalidateTag`
  takes a second `cacheLife` argument.
- **Prisma 7** — a **driver adapter is required**; bare `new PrismaClient()` no longer
  compiles. The datasource `url` has moved out of `schema.prisma` into `prisma.config.ts`,
  which does not auto-load `.env` (hence `import "dotenv/config"`). The generator is
  `prisma-client` with an explicit `output`, generating to `/generated` (gitignored).
  `migrate diff --to-schema-datamodel` is now `--to-schema`.
- **Tailwind v4** — CSS-first config. Tokens live in `@theme inline` in `app/globals.css`;
  there is no `tailwind.config.ts`.
- **Zod 4**.
- **shadcn/ui is vendored, not stock.** Only `Table`, `Checkbox` and `Dialog` are here, in
  PascalCase with named exports — a multi-export primitive set can't follow the
  "components default-export" rule, so it's the documented exception. `shadcn add` writes
  kebab-case; rename after adding.

  Two of its semantic names mean the opposite of what they mean here: `--accent` is voidix's
  amber but shadcn's neutral *hover surface*, and `--muted` is faded *text* here but a *surface*
  there. Aliasing cannot satisfy both readings of one token, so those usages were rewritten to
  `bg-card` inside the primitives. **Re-running `shadcn add` overwrites the file and brings
  `bg-accent` / `bg-muted` / `text-accent-foreground` back with it** — sweep them again, or
  dropdown rows will hover solid amber. Everything else is aliased in `@theme inline`; see the
  comment there. Note also that `Dialog` imports `@/components/ui/button` lowercase, which
  resolves to the project's own `Button` on a case-insensitive filesystem and then fails on its
  `variant="outline"`.

## Architecture

**Draft and release are separate layers.** The tables (`services`, `projects`, `faq_entries`
plus ordered child tables) are the working draft. Publishing serialises the whole draft into
one append-only `content_releases` row shaped exactly like the site's TypeScript arrays. Never
mutate an existing release; publish writes a new version. The site (once wired) reads the
newest release, never the draft tables.

**One footer list feeds two footers.** `footer_link_groups` + `footer_links` mirror the site's
`CONTACT_FOOTER_GROUPS`, which the homepage's contact section and the document pages both render
— deliberately, so a changed handle cannot land in one and not the other. The two have very
different space budgets, so a longer label wants checking on a 360px phone, not just on `/about`.
There is no `is_external` column: it is derived from the href in `contentPayload`, because a
stored flag could disagree with the URL beside it.

**A document page owns its copy but not its structure.** About and Careers are a singleton for
the prose plus standalone ordered tables for their lists — the arrangement `FooterContent`
already uses. What the panel deliberately does **not** own is the numbered section list
(`ABOUT_SECTIONS` / `CAREERS_SECTIONS` on the site): each entry's `key` is both the section's
anchor id and the station the orbit rail scrolls to, so it is structure, and an editor renaming
one would break in-page navigation with nothing to catch it.

**A continuation seed carries a trailing space, and the payload adds it.** `briefSeed` and
`openApplicationSeed` are left mid-sentence for the applicant to finish. Every string here is
trimmed on save by `toPlainLine`, which is right for all of them and would eat that space, so
`continuationSeed()` in `contentPayload.ts` puts it back at publish time. Never ask an editor to
type an invisible character.

**Career roles are never seeded.** The four openings in the site's source are invented
placeholders, and unlike a placeholder project a job posting is something a person can waste an
afternoon on. An empty list is the honest default — the careers page renders its own empty line
and is built to stand in that state.

**Every Server Action re-checks auth.** `requireUser()` at the top of each one. The proxy
guards page routes, but Server Actions are reachable by direct POST and do not go through it.

**`/api/submissions` and `/api/applications` are the only unauthenticated routes.** Both are
exempted in `PUBLIC_PATHS` and both go through `lib/leads/intake.ts` — secret, origin, honeypot,
rate limit — and **fail closed** when unconfigured. Anything added to `PUBLIC_PATHS` takes on the
same obligation. (`/api/leads` was renamed to `/api/submissions` when it stopped creating leads.)

**A website submission is not a lead until somebody says so.** The enquiry form writes one row to
`submissions` and stops. `promoteSubmission` is the *only* path from there to `contacts`, and it
is the fourth intake route — it owns the deduplication, the auto-assignment and `originColumns`
that used to sit in the endpoint. The point is that spam, tests and "hi" never reach the
pipeline, the counts or the reports, so they are deleted from a table nothing else reads instead
of filtered out of one everything reads. Promoting a known email appends an `Enquiry` to that
person; it never creates a second contact. Promoting twice is a no-op.

**⚠ The rate limiter counts `submissions` + `career_applications`, not `enquiries`.** It counted
enquiries when the form created one directly. It no longer does, so counting them would leave the
limiter reading zero forever and the public endpoints effectively unlimited — a rate limit that
silently stops counting is worse than none, because nothing looks broken. Both tables share one
budget: an attacker does not care which one they flood.

**An application is never a lead.** `career_applications` has no path to `contacts` at all — a
candidate is not a prospect, and a CV is far more sensitive than an enquiry. `role_title` is a
snapshot because closing a role means *deleting* it, and the application must still say what it
was for. **No file ever reaches this app**: the site uploads the CV to UploadThing and sends the
resulting URL, so deleting an application removes our link, not the file.

**Both intake tables are admin-only, and the reason is structural.** Neither has an owner column,
so `visibility.ts` has nothing to scope by — the role is the whole gate.

**Leads are not content.** They never enter a release, never get published, and are deleted
for real rather than flagged. Raw IPs are never stored, only a salted hash.

**One enquiry form, six places.** The services deck, the works field, the FAQ hologram, the
contact section, `/about` and `/careers` all render the site's single `EnquiryForm`. Its shared
strings live in `enquiry_form_content`, not on any one section — putting them on Contact would
say they were Contact's, and the next editor would wonder why changing them moved the works form
too. What a section genuinely overrides stays with that section (`contact_section.brief_label`,
`careers_page.application_brief_label`).

**`disciplines` is one vocabulary with three consumers.** The fleet sells a discipline, a project
is *of* one, and the enquiry form arrives knowing which. `key` is what the site binds to and is
not editable — renaming it would silently unbind every service and project from its CTA.

**The leads table pages in the database.** `lib/leads/leadQuery.ts` is the only place a page of
leads is fetched; TanStack runs in manual mode and is the rendering model, not the data engine.
Loading every lead into the browser would put the whole pipeline's names, emails and phone
numbers in the page payload and fall over well before the 5,000-row import cap. Sorting by a
custom field queries **from** `contact_field_values` with the contact filter nested inside, so
`visibility.ts` is still the one gate — a raw SQL `ORDER BY` would have stepped around it.

**The leads table's column layout has exactly one home:** `lead_settings.leads_table_columns`.
Field definitions deliberately carry no "show in table" flag — two places to control one
decision means two ways to disagree, with nothing to arbitrate between them.

**The leads table scrolls sideways; the page scrolls down.** These are exclusive, and the reason
will come up again: `position: sticky` resolves against the nearest scrolling ancestor. Give the
table its own scrollbox and the column headings stick to the box instead of the window; hand that
overflow to the page and reaching the last column drags the heading, tabs and search box off to
the left with it. The scrollbox won, which is also what makes the pinned Name column possible.
The table is never `flex-1` (that stretches five rows into a half-empty box) and never scrolls
vertically. Below 640px the rows render as cards instead. Pages declare their own width —
prose and forms wrap in `ReadingColumn`, tables and reports use the whole shell.

**Chart colour is computed, not chosen.** `--chart-1..6` in `app/globals.css` is an *ordinal*
ramp — one hue, monotone lightness, validated against the `--card` surface. It encodes position
in the pipeline. Nominal categories (lead sources) take **one** step for every bar: colouring
them differently spends the identity channel re-encoding what bar length already shows. Won and
Lost wear `--success`/`--danger` and never join the ramp, because a status colour must not double
as a series. If you change those steps, re-run the check rather than eyeballing it.

**Stages replaced the old NEW/READ/ARCHIVED status.** `pipeline_stages` is editable vocabulary,
but each row carries a `kind` of OPEN/WON/LOST so the system knows which stages end the
conversation — that is what makes "open pipeline" countable and stops a closed lead being
chased as overdue. Archiving is a separate boolean, not a stage.

**A custom field is retired, never deleted.** Values survive in `contact_field_values`, so
restoring the definition restores the data, and no admin can wipe hundreds of records with one
mis-click. The `kind` is fixed after creation: stored values live in a column chosen by it, so
changing it would strand them.

**Lead visibility goes through `lib/leads/visibility.ts`.** Never write a contact query that
filters by owner inline — sales must see only their own leads, and a query that forgets is a
silent cross-account leak. Server Actions re-check per contact via `loadPermittedContact`,
because an action accepts whatever id it is POSTed. **`lib/leads/reports.ts` is bound by the same
rule** — an aggregate is the easiest place to leak a pipeline, because the number looks
unremarkable and no name you shouldn't have seen ever appears on screen. Its owner filter can
only ever narrow: for Sales it is ignored outright.

**How a lead got here lives on the contact, not on its enquiries.** `contacts.origin_*` is written
once at creation and never rewritten; `Enquiry.source` answers the same question *per approach*,
which is a different one — a lead imported in March who fills in the form in June was still added
by the import. `origin_source` has **no database default on purpose**, so a new intake route fails
to compile rather than guessing. Build the columns with `originColumns()` in
`lib/leads/leadOrigin.ts`; all three intake routes go through it.

**Reaching out (`ContactAttempt`) is not reaching in (`Enquiry`).** Keep them separate, and
store the channel/outcome as a text snapshot rather than a foreign key so renaming the
vocabulary never rewrites history.

**A person is a `Contact`; an approach is an `Enquiry`.** Never write a code path that creates
a second contact for an email that already exists — all three intake routes (website form,
manual add, spreadsheet import) attach to the existing person instead. `contacts.email` is
unique and always stored lowercased via `normaliseEmail`; that index is the mechanism, so any
path that skips the normalisation silently reopens the duplicate problem.

**Roles live in `team_members`, not Supabase Auth.** Auth proves identity, the team row grants
permission. An Auth user with no row can sign in and see nothing — that is the intended
default, not a bug. Content pages are gated by `app/admin/(content)/layout.tsx` and every
content action calls `requireAdmin()` separately, because actions are POST endpoints that
never pass through a layout.

**The service role key is confined to `lib/supabase/admin.ts`**, which is `server-only`. It
bypasses RLS and can create or delete any user, so it must never be imported anywhere that
could end up in a client bundle, and every caller sits behind `requireAdmin()`.

**A `"use server"` file may only export async functions.** Every export in such a module
becomes a server-function reference, so an exported constant arrives on the client as a stub,
not a value — which is exactly how an `IDLE_*` state object once became `undefined` at first
render. Shared constants and types belong in a plain module (see `lib/leads/importState.ts`).

**Two database URLs, not one.** `DATABASE_URL` is pooled (6543) for the app; `DIRECT_URL` is
direct (5432) for migrations and the seed. Pointing migrations at the pooler breaks them.

**RLS is on with no policies.** Supabase exposes every `public` table through PostgREST to
anyone holding the anon key, and that key ships to the browser. Prisma connects as the owner
and bypasses RLS. If you add a table, add it to the RLS migration too.

## Conventions

Follow the site's conventions, since the two codebases are read together:

- **No abbreviations in names.** `currentUser`, not `u`. `serviceCapability`, not `cap`.
- **Files describe their contents** — `contentPayload.ts`, `plainText.ts`, never `utils.ts`.
  `.tsx` is PascalCase and named after the component it exports; `.ts` is camelCase.
- **Components live in a folder by category** (`components/ui`, `components/layout`).
- **Never hardcode a colour.** Use the tokens in `app/globals.css` — they are copied from the
  site's design system, so a change there should be mirrored here.
- **Comments explain why**, not what. No JSDoc on every function.
- **Exports**: components default, everything else named.
- **No magic numbers** — named constants at the top of the file.

## Content rules

- Every string renders as plain text on the site. Strip HTML on save (`toPlainLine`); only
  *flag* markdown (`findMarkdownWarnings`) — don't rewrite an editor's prose.
- Field length caps are layout constraints. They live in one place, `FIELD_LIMITS`, so the
  counter shown in the UI and the limit enforced on save can't drift.
- `index` / ordinals are **derived from `sortOrder`**, never stored and never typed by an
  editor. Deletes renumber the remainder so ordinals stay contiguous.
