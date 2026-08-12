# voidix-cms — what was built, and why

A full record of this project: the decisions, the reasoning behind them, the shape of the
system, and the things that are deliberately missing.

`README.md` is the short version — how to set it up and run it. This is the long version, for
whoever picks the project up next and needs to know *why* it looks the way it does.

**Audit date:** 29 July 2026. Source of truth is the code; if they disagree, the code wins.

---

## 1. What this is

A content control panel for the [voidix](https://github.com/Nexa-dev-co/orbix-dev) site
(`../orbix-dev`), plus a lead pipeline for the sales team.

Two jobs that share a login and nothing else:

| | Purpose | Reaches the public site? |
| --- | --- | --- |
| **Site copy** | The text of five sections | Yes, when published |
| **Leads** | Enquiries and sales follow-up | Never |

The two are kept apart everywhere — separate nav groups, separate roles, separate tables.
Leads are never part of a release and never published; "publish" acts only on copy.

### Relationship to the site

The site is a cinematic single-page WebGL experience. It has **not** been wired to this CMS.
Publishing works today — it stores a release and records the site rebuild as *skipped* — but
the site still reads its hardcoded TypeScript arrays. Connecting the two is a separate task
(§11).

---

## 2. Decisions, and why

Every one of these was a fork in the road. Recording the reasoning matters more than
recording the outcome, because the outcome is visible in the code and the reasoning isn't.

### 2.1 Draft and release are separate layers

**Decision:** the editing tables are a working draft. Publishing serialises the whole draft
into one append-only `content_releases` row.

**Why:** an editor must be able to leave a half-written FAQ answer for a week without it
appearing on the site. A `published` boolean per row can't express that, because it can't
hold two versions of the same record. Snapshotting the whole payload also gives version
history and rollback for free, and means the site eventually reads one row instead of joining
six tables — atomically consistent, and impossible to catch mid-edit.

**Cost:** the published shape is JSON, not normalised. Acceptable, because the site consumes
it as typed arrays anyway.

### 2.2 A person is a `Contact`; an approach is an `Enquiry`

**Decision:** split the original flat `Lead` table in two.

**Why:** this was the sharpest question in the project. The first design had one row per
enquiry, which made "duplicate" impossible to define — someone enquiring twice isn't a
duplicate of anything, and skipping their second message throws away the thing you most
wanted to read. The suggested fix was a duplicate *flag*, but a flag defers the decision
rather than making it: nobody merges flagged rows, and with per-salesperson assignment two
rows for one human means two owners calling the same person.

Splitting person from approach dissolves the problem instead of managing it. A second
submission from a known email becomes another enquiry on the existing person — visible as
"3rd time they've reached out" rather than hidden as a duplicate.

**Timing:** done while the table had 0 rows. The same change with 5,000 leads and a team
working them daily is a migration you keep postponing.

**The invariant this creates:** `contacts.email` is unique and always stored lowercased via
`normaliseEmail`. That index is the entire mechanism. Any code path that skips the
normalisation silently reopens the duplicate problem through the back door.

### 2.3 Roles live in `team_members`, not Supabase Auth

**Decision:** Supabase Auth owns the credential; a `team_members` row owns the role. Linked
by email.

**Why:** roles need to be queryable — to list who a lead can be assigned to — and Auth's user
table isn't readable from the app without the service role key. The split also produces a
useful default: **an Auth account with no team row can sign in and see nothing.** Creating a
login does not grant access. That is the safe failure mode for an account created outside the
panel.

### 2.4 Sales see only their own leads

**Decision:** enforced in one module, `lib/leads/visibility.ts`, which every list, count and
detail lookup goes through.

**Why:** a per-page filter is a filter you can forget, and forgetting it means one
salesperson silently reads another's pipeline — a leak nobody notices until it matters.
One chokepoint is auditable; twelve inline `where` clauses are not.

The detail page re-checks per contact and returns `notFound()` rather than a redirect, so a
salesperson probing ids can't distinguish "exists but isn't yours" from "no such lead".

### 2.5 Stages replaced the status, rather than sitting beside it

**Decision:** `LeadStatus` (NEW / READ / ARCHIVED) was dropped. Contacts point at an editable
`pipeline_stages` row, and archiving became a separate boolean.

**Why:** New/Read/Archived describes an inbox — has anyone looked at this yet — and the team
works outbound lists where the question is how far along someone is. Keeping both would have
been the cheaper change and the worse one: two similar-looking fields with no rule for which
one wins, and a team asking "is this Read or Contacted?" every week. That is the same mistake
§2.2 rejects — deferring a decision instead of making it.

**The wrinkle that made it non-trivial:** stages are editable vocabulary, so nothing in a list
of words tells the system that Won and Lost are over. Hence `kind` (OPEN / WON / LOST) on each
stage. Without it "how many open leads?" is a guess based on position in the list, and a lead
that said no six months ago keeps surfacing as an overdue follow-up.

**Migration note:** the auto-generated diff would have destroyed data here. It adds `stage_id`
as `NOT NULL` to a table with rows in it (which fails outright) and drops `status` before
anything reads it. The hand-written migration seeds the stages, adds the column nullable,
back-fills `NEW → New` / `READ → Contacted` / `ARCHIVED → is_archived`, and only then tightens
and drops. *Lesson: read what `migrate diff` generates before trusting it — the statement order
it picks assumes an empty table.*

### 2.6 Custom fields are relational rows, not a JSON blob

**Decision:** `contact_field_definitions` + `contact_field_values`, with one typed column per
kind, rather than a `jsonb` bag on `contacts`.

**Why:** the leads table sorts on these. A single text column would order 9 after 10 and put
"12 Aug" before "1 Jan" — a Budget column that sorts wrong is worse than no Budget column.
Typed columns also mean a value has real referential integrity, and deleting a contact takes
their values with it, which an erasure request needs.

**Cost:** Prisma can't `orderBy` a child row's value, so sorting needs the inversion described
in §8. The alternative was raw SQL, which would have stepped around `visibility.ts`.

**Retire, never delete.** Same bargain as the attempt vocabulary: values survive, restoring the
definition restores the data, and no admin can wipe hundreds of records with one mis-click.
The `kind` is also fixed after creation — stored values live in a column chosen by it, so
converting a text field to a number would strand every one of them with nothing to migrate to.

### 2.6a Where a lead came from is stored on the contact, not derived

**Decision:** five `origin_*` columns on `contacts`, written once at creation by all three intake
routes and never rewritten.

**Why:** `Enquiry.source` already answers this *per approach* — but that is a different question.
Someone imported from a list in March who then fills in the website form in June has two enquiries
with two different sources, and they were still *added* by the import. Deriving the contact's
origin from its earliest enquiry means a correlated subquery on every row of a table that pages in
the database, and a reporting `GROUP BY` over "earliest enquiry per contact" rather than one
indexed column.

**The column has no default, deliberately.** Every path that creates a contact must state where
the lead came from, so a fourth intake route added later fails to compile rather than silently
recording the wrong channel. That is already load-bearing: it is what forced all three existing
call sites to be updated rather than one being missed.

**Migration note, same lesson as §2.5:** the generated diff adds `origin_source` as `NOT NULL` to a
table with rows in it, which fails outright. The hand-written migration adds it nullable, back-fills
each contact from its own earliest enquiry (and, for imports, the person who uploaded the file),
then tightens. Manual adds made before the migration have no recorded author anywhere, so they stay
blank — guessing from `assigned_to_id` would look like a fact and be wrong for every lead that had
since been handed on.

### 2.7 Every Server Action re-checks permission

**Decision:** `requireAdmin()` / `requireMember()` at the top of every action, and
`loadPermittedContact()` before every contact mutation.

**Why:** Server Actions are POST endpoints. They do not pass through page routing, so a
route-group layout protects the *page* and nothing else. An action accepts whatever id it is
given. Hiding a nav link is presentation; these checks are the control.

### 2.8 Strip HTML, only flag markdown

**Decision:** HTML is removed on save. Markdown is warned about in the editor, never rewritten.

**Why:** `<p>` in prose is never intentional, so removing it is unambiguous. Asterisks and
underscores appear in legitimate sentences, so rewriting them would mangle an editor's words —
worse than telling them what will happen.

### 2.9 Ordinals are derived, never stored

**Decision:** `index` ("01", "02") is computed from array position at publish time.

**Why:** a stored ordinal drifts. Deleting item 2 of 4 leaves a gap unless something
renumbers, and that something is a bug waiting to happen. Deriving it makes gaps impossible.

---

## 3. Stack, and the version traps

Next.js 16.2.12 · React 19.2.4 · TypeScript 5 · Tailwind v4 · Prisma 7.9.1 · Supabase
(Postgres + Auth) · Zod 4 · ExcelJS 4.4

Four of these differ significantly from what most references describe. Each was verified
against the installed version rather than assumed:

- **Next 16** — `middleware.ts` is now **`proxy.ts`** (Node runtime only, no edge).
  `params`, `searchParams`, `cookies()` and `headers()` are async with no sync fallback.
  Turbopack is the default. `next lint` is gone. `revalidateTag` takes a second argument.
- **Prisma 7** — a **driver adapter is required**; bare `new PrismaClient()` no longer
  compiles. The datasource `url` moved out of `schema.prisma` into `prisma.config.ts`, which
  does not auto-load `.env` (hence `import "dotenv/config"`). `migrate diff --from-url` and
  `--to-schema-datamodel` were both removed in favour of `--from-config-datasource` /
  `--to-schema`.
- **Tailwind v4** — CSS-first. Tokens live in `@theme inline` in `app/globals.css`; there is
  no `tailwind.config.ts`.
- **ExcelJS, not `xlsx`** — SheetJS moved distribution off npm, so the registry copy is frozen
  at 0.18.5 with unpatched prototype-pollution advisories. This parser handles files uploaded
  by people, so that mattered.

### Design tokens

Copied verbatim from the site (`#060606` background, `#00e5ff` accent, Syne + DM Sans), so an
editor moving between panel and site doesn't feel like they changed product. They are copies,
not imports — a change on the site must be mirrored here.

---

## 4. Data model

Five migrations, applied in order:

| Migration | What it added |
| --- | --- |
| `20260728000000_init` | Services, Works, FAQ + ordered child tables, `content_releases` |
| `20260728000001_enable_rls` | RLS on all of the above |
| `20260728000002_contact_footer_leads` | Contact section, footer, first leads table (+ RLS) |
| `20260729000000_contacts_and_team` | Team, contacts/enquiries split, import batches (+ RLS) |
| `20260729000001_attempts_and_settings` | Attempts, vocabulary, lead settings (+ RLS, seeded vocab) |
| `20260729000002_pipeline_stages_and_custom_fields` | Pipeline stages, stage history, custom fields, follow-up dates; drops `status` (+ RLS, seeded stages) |
| `20260730000000_lead_origin` | Where each lead came from, on `contacts` (no new table, so no new RLS) |
| `20260812000000_about_and_careers` | The two document pages: About and Careers singletons, their ordered lists, career roles + bullets (+ RLS) |
| `20260812000001_contact_footer_reshape` | Contact and Footer rebuilt to match the sections the site actually shipped; footer links become titled groups (+ RLS, incl. re-enabling it on the recreated `contact_section`) |
| `20260812000002_inbox_applications_disciplines` | `disciplines` (seeded, linked from services and projects), `enquiry_form_content`, `submissions`, `career_applications` (+ RLS) |

### Content

```
services              slug, sort_order, name(80), eyebrow(120), description
  service_capabilities  sort_order, label(40)          ordered chips
projects              slug, sort_order, title(80), client(120), year(8), description
  project_tags          sort_order, label(40)          ordered chips
faq_entries           sort_order, question(200)
  faq_paragraphs        sort_order, body               one <p> each
contact_section       singleton — title(120), lead, brief_label(60), submit_label(40)
footer_content        singleton — tagline(120), sign_off(160)
  footer_link_groups    sort_order, title(40)
    footer_links          sort_order, label(60), href(500)
about_page            singleton — masthead, quote, notes, closing, cross-link
  about_premise_paragraphs  sort_order, body           one <p> each
  about_principles          sort_order, claim(80), backing
  about_build_phases        sort_order, span(40), name(40), detail
  about_instruments         sort_order, label(40), value(40)
  about_stack_items         sort_order, label(40)      ordered chips
careers_page          singleton — masthead, empty state, open application, form strings
  careers_working_here      sort_order, claim(80), backing
  careers_hiring_phases     sort_order, span(40), name(40), detail
  careers_commitment_options sort_order, label(40)
career_roles          slug, sort_order, title(100), location(60), commitment(60), brief_seed(200)
  career_role_bullets   kind(OWNS|NEEDS|BONUS), sort_order, label
disciplines           key UNIQUE(web|mobile|enterprise|ai), sort_order, label(60), brief_seed(300)
  services.discipline_id  →   projects.discipline_id →
enquiry_form_content  singleton — field labels, sending/sent/failed, {project} templates
content_releases      version, payload(jsonb), note, published_by, revalidate_status
```

Column widths are layout constraints, not padding — `name` sits in a four-across carousel row,
`eyebrow` is one line. They live once in `FIELD_LIMITS` so the counter shown in the UI and the
limit enforced on save cannot drift.

**The document pages are singleton + standalone ordered tables**, the arrangement
`footer_content` already uses. Services, Works and FAQ are each *one repeating thing*; a document
page is a masthead plus several unrelated lists, and those lists have no parent row to hang off.

**`career_role_bullets` uses a `kind` column where the footer's two link tables use a table
split, and that is not an inconsistency.** The footer's social and legal lists render in
different places, so splitting them cost nothing and a `kind` column would have duplicated the
split. A role's three lists render in the same card, in the same shape, differing only by the
heading above them — three identical tables would mean three identical models and three
identical write paths.

**`Claim` and `Phase` are shared shapes**, so About's principles and Careers' claims carry the
same columns and the same `FIELD_LIMITS` entries. The site shares one type across both pages;
two sets of limits would be two places for them to drift.

**Footer links have no `is_external` column.** The site flags four of its nine links as opening
in a new tab, and that flag is a *function of the href*: `http(s)` leaves the site, a
root-relative path and a `mailto:` do not. Derived in `contentPayload` like the ordinals, because
a stored copy could disagree with the URL sitting next to it and no editor could tell which was
right. Verified to reproduce the site's hand-maintained array exactly.

**`isSafeLinkUrl` allows `mailto:` and `tel:` as well as `http(s)` and root-relative paths**,
because the contact address lives in the footer's `Direct` group rather than in a field of its
own. Everything else is rejected — these hrefs become anchors on a public page, so an unchecked
scheme is a stored XSS vector reachable by anyone who can log into this panel. `//evil.com` is
rejected too: a protocol-relative URL is an off-site link wearing a path.

### What the website sends

```
submissions          name, email (lowercased, NOT unique), company, message,
                     source, ip_hash, user_agent, created_at,
                     promoted_at + promoted_contact_id + promoted_by_id,
                     dismissed_at
career_applications  name, email, phone, why_you, work_link, cv_url,
                     role_id → career_roles (SET NULL), role_title (snapshot),
                     commitment, ip_hash, user_agent, created_at,
                     reviewed_at + reviewed_by_id
```

**Neither is a lead.** `submissions` becomes one only through `promoteSubmission`;
`career_applications` never does. Both are written by unauthenticated routes and both are
admin-only — neither has an owner column, so `visibility.ts` has nothing to scope by and the role
is the whole gate.

**`submissions.email` is deliberately not unique**, unlike `contacts.email`. Deduplication is a
decision about *people*; this table holds *messages*. One person enquiring three times is three
submissions and, after promotion, one contact with three enquiries.

**`career_applications.role_title` is a snapshot and `role_id` is `SET NULL`.** Closing a role is
done by deleting it, and an application must still say what it was for a year later — the same
rule `contact_attempts` follows for the channel and outcome vocabulary.

### Leads

```
team_members     auth_user_id, email, name, role(ADMIN|SALES), is_active
pipeline_stages  label UNIQUE, kind(OPEN|WON|LOST), sort_order, is_active
contacts         email UNIQUE lowercased, name, company, phone,
                 stage → pipeline_stages, is_archived, next_follow_up_at,
                 notes, assigned_to → team_members,
                 origin_source + origin_member (+name snapshot) + origin_batch + origin_label
  enquiries             source(CONTACT_FORM|MANUAL|IMPORT), message, import_batch, ip_hash
  contact_attempts      member + member_name snapshot, channel, outcome, note, next_due_at
  contact_stage_changes member snapshot, from_stage, to_stage, reason, attempt_id
  contact_field_values  definition, one typed column per kind, UNIQUE(contact, definition)
contact_field_definitions  key, label, kind(8 kinds), options[], sort_order, is_active
attempt_channels   editable vocabulary, soft-retired via is_active
attempt_outcomes   editable vocabulary
lead_settings      singleton — routing, sales permissions, import defaults,
                   leads_table_columns(jsonb)
import_batches     filename, imported_by, per-outcome counts
```

Details worth calling out:

- **`contact_attempts` stores `channel` and `outcome` as text, not foreign keys.** An admin
  renaming "Spoke" to "Spoke — interested" must not silently rewrite what someone recorded
  last month. `member_name`, `from_stage` and `to_stage` are snapshotted for the same reason.
- **Deleting a team member does not delete their leads.** `assigned_to` is `SetNull`, so the
  leads become unassigned rather than disappearing with the person.
- **`contacts.stage_id` is `Restrict`, not `SetNull`.** A stage holding leads cannot be deleted
  even by accident — and there is no delete path in the UI anyway, only retire.
- **Two places record a follow-up date, deliberately.** `contacts.next_follow_up_at` is the
  current one and the only thing the table sorts on; `contact_attempts.next_due_at` is what was
  *promised* at the time, so the timeline can still read "said they'd decide by 12 July" after
  the date has moved twice.
- **`contact_field_values` has one index per sortable column** (`value_text`, `value_number`,
  `value_date`, each paired with `definition_id`), because that is exactly the shape of the
  query the leads table issues when sorting on a custom field.
- **`leads_table_columns` is a `Json` column with no shape guarantee**, so
  `parseColumnLayout` is deliberately defensive and returns `[]` for anything unexpected rather
  than letting a hand-edited row crash the leads page.

---

## 5. Security posture

### RLS is on, with no policies

Supabase exposes every `public` table through PostgREST to anyone holding the anon key — and
that key ships to the browser. Without RLS the entire CMS, including other people's names,
emails and messages, would be readable *and writable* at
`https://<project>.supabase.co/rest/v1/contacts`.

Every table has RLS enabled and no policies, which is a deny-all for `anon` and
`authenticated`. Prisma connects as the database owner and bypasses RLS, so the app is
unaffected. Privileges are also explicitly revoked, so a future "disable RLS to debug
something" doesn't quietly open the door.

**Verified by request, not by assumption** — every table returns `42501 permission denied`
to the anon key.

> **If you add a table, add it to the RLS statements in the same migration.** Not a follow-up
> migration — the same one. A separate migration leaves a window, however short, in which the
> table exists and is world-readable.

Two tables where this matters beyond privacy: `team_members` carries the role column, and
`lead_settings` carries the Sales permission flags. A writable copy of either through
PostgREST would let anyone with the public key grant themselves admin.

### The service role key

Confined to `lib/supabase/admin.ts`, which is marked **`server-only`** — importing it from a
Client Component is a build error rather than a silent leak. It bypasses RLS and can create or
delete any user, so every caller sits behind `requireAdmin()`.

### The one public endpoint

`POST /api/submissions` and `POST /api/applications` are the only routes reachable without a
session, and neither creates a lead — the first fills the Inbox, the second fills Applications.
Both are exempted in
`PUBLIC_PATHS` and authenticates itself:

1. Constant-time shared-secret comparison (`x-voidix-secret`)
2. Optional origin allowlist
3. Honeypot field (`website`) — answered with success so bots learn nothing
4. Per-IP-hash rate limit, counting **enquiries** not contacts (one person submitting fifty
   times creates one contact and fifty enquiries; counting contacts would miss the flood)

**It fails closed.** With no `LEADS_INTAKE_SECRET` set it rejects everything. An endpoint
nobody finished configuring should be shut, not open.

> The secret only protects you if the site calls this **from its own server**. If the site's
> form posts from the browser, the secret ships to every visitor and the origin check, rate
> limit and honeypot become the only real defences.

### Personal data

Raw IPs are never stored — only a salted SHA-256, enough to rate-limit and not enough to
identify. Deleting a contact is a real delete, not a hidden flag, because that is what an
erasure request needs; it is admin-only, and archiving is the everyday alternative every role
can use.

---

## 6. Feature reference

### Site copy

| Section | What's possible | Constraint |
| --- | --- | --- |
| **Services** | Edit text only | No add, delete or reorder |
| **Works** | Full CRUD + reorder | New projects share one fallback rock |
| **FAQ** | Full CRUD + reorder | None — the freest section |
| **Contact** | Edit copy + all form strings | Section doesn't exist on the site yet |
| **Footer** | Tagline, copyright, two link lists | Doesn't exist on the site yet |

**Why Services is locked:** a service is a vessel. Adding one needs a `.glb`, Draco
compression, a hull palette and placement tuned through `?tune`. Worse, the site's
`deckTuning.ts` keys ship placements by *array position* and encodes that position inside
`hiddenParts` strings like `"2:14"` — reorder or delete a service and every placement binds to
the wrong vessel. Nothing throws; the fleet just sits wrong. Making the list mutable is a
site-side refactor first: move placement onto the service record and key `hiddenParts` by slug.

The Works page warns when the project count leaves four, because `WorksField.tsx` hardcodes
the heading "Four fires."

### Leads

- **Table** — a real table with admin-composed columns. Stage tabs built from the vocabulary,
  plus Due today / Overdue / Archived, owner tabs (Mine/Unassigned/Everyone) shown only when
  they mean something for that role, a source filter that also lists recent import files by
  name, and search across name, email and company. Sorting, filtering, searching and paging all
  happen in the database and live in the URL, so any view is linkable and survives a refresh.
  Clicking anywhere on a row opens the lead; the name stays a real link so the keyboard still
  has a labelled target. See §14 for the layout rules the table is built on.
- **Selection and bulk actions** — tick rows to move stage, assign, or archive in one go. Every
  bulk action re-checks permission per contact and silently drops what the caller may not
  touch, because a selection can go stale between being rendered and being submitted.
- **Detail** — stage bar, owner, how the lead got here, the admin-defined fields, one merged
  timeline (attempts, stage moves and enquiries in one story rather than three lists), notes.
- **Follow-up wizard** — see §8.
- **Add by hand** — assigned to you; a known email appends to that person instead of creating a
  second record.
- **Import** — see §7.
- **Reports** — see §13.

### Where a lead came from

Two columns on the table, `Source` and `Added by`, plus a line on the lead's own page reading
"Imported from a spreadsheet (q3.xlsx) by Sara Khaled on 12 July". The source filter narrows to
one channel or to one spreadsheet, counted through `visibility.ts` so a salesperson is only
offered files that produced leads they can actually read.

The filter matches where a lead *came from*, not every contact a spreadsheet touched: a row
matching somebody already in the system logs an enquiry against them without changing their
origin, and listing those under `q3.xlsx` would contradict the Source column beside them.

The website form may pass its own short label (a page name, a campaign) as `source` in the intake
payload; it lands in the same slot the filename and the adder's name occupy. Nothing is sent
today — the site has no form yet — so website leads simply read "Website form".

### Custom fields (admin only)

An admin defines extra things to record about a person: **text, long text, number, date,
checkbox, link, dropdown and multi-select.** Each becomes a column on the table, a box on the
contact page, and a mappable column in the importer — all at once, from one definition.

Retiring a field hides it everywhere and keeps every value. The kind is fixed after creation
(§2.6). Deleting is not offered at all.

### Team

One form creates the Supabase Auth login **and** the permissions, returning a one-time
password with a copy button. Also: reissue a password, deactivate, or remove (deletes the
login; leads become unassigned). Add is transactional — if the team row fails, the login it
just created is deleted, so a failed add can't strand an account that can sign in and only
ever reach `/no-access`.

The last active admin cannot demote or deactivate themselves. Nothing inside the app could
undo it.

### Settings (admin only)

- **New website leads** — unassigned, round-robin across active sales, or one fixed person.
  The round-robin pointer is persisted, because the rotation must survive restarts and
  serverless has no process memory.
- **What Sales can do** — edit details, claim unassigned, export, see others' attempts, mark
  leads won or lost, edit the custom fields. Every widening toggle defaults to off.
- **The pipeline** — add, rename, reorder and retire stages, each with its OPEN/WON/LOST kind.
  The last open stage cannot be retired: new leads would have nowhere to land, and both the UI
  and the action refuse it.
- **Extra fields** — the custom field definitions, and the leads table's column layout. One
  layout for the whole team; widths are dragged on the table itself and saved on release, not
  on every mouse move, because the layout is shared and a 300-pixel drag must not be 300 writes.
- **Imports** — default action for existing rows, max rows, whether overwrite is allowed at
  all. Turning overwrite off removes it from the UI *and* rejects it server-side.
- **Attempt vocabulary** — channels and outcomes, retired rather than deleted. The first
  outcome matching "no answer" is what the quick button on a contact records.

---

## 7. The import wizard

`.xlsx` or `.csv`, first sheet, first row as headers. 5MB cap; row cap configurable.

**Upload → map columns → preview → assign → commit.** Nothing is written until the last step.

### Column detection

Headers are **scored**, not exact-matched. The first version compared against a fixed list and
failed on the first realistic file it met — `Customer Name`, `E-mail Address`,
`Organisation Name`, `Mobile Number`, `Additional Notes` matched *nothing*, and the wizard
blocked. Scoring degrades gracefully: an unseen header like "Primary Contact Email" still
matches on the `email` token, and exclusion tokens stop "Company Name" being read as a person.

A few real values from each column are shown under its dropdown, because headers lie and
values don't.

### Row outcomes

| Outcome | Meaning |
| --- | --- |
| **New** | Email not seen before |
| **Already here** | Email exists — you choose what happens |
| **Repeat in file** | Same email earlier in this file; the first wins |
| **Rejected** | No email, or not an address |

For rows that already exist: **Fill blanks** (default), **History only**, **Overwrite**, or
**Ignore** — per row, or set all at once. Non-fatal adjustments are surfaced as warnings
rather than silently applied.

### Assignment

Admins choose: leave unassigned, all to one person, or split evenly across ticked people, with
the distribution shown before committing. Applies to newly created contacts only — an import
never reassigns a lead someone already owns. A salesperson importing gets the leads themselves.

### Why the preview can be trusted

It is generated by the same function that performs the import (`buildImportPlan`), so it
cannot drift from the outcome the way a separately-written summary would. The commit step
**re-plans** from the submitted rows rather than trusting a plan posted back from the browser —
the client could have altered it, and the database may have moved on. The preview is a
forecast; the commit is the decision.

---

## 8. The follow-up wizard

Four steps in a dialog on the contact page: **what you did → how it went → where it stands →
what's next**, then a review.

It replaced a flat form that took a channel, an outcome and a note. That form worked, but it
never asked the last two questions at all — a lead could be phoned twenty times without ever
moving stage or having a next date set, and nothing in the system would notice. Splitting the
questions is the point: logging a call and deciding what happens to the lead are different
decisions, and the old form quietly only made the first.

**One transaction.** The attempt, the stage move and the next follow-up date are written
together. A follow-up where the call was recorded but the lead never moved — or moved with no
record of why — is worse than one that failed outright and can be retried.

**Leaving the stage alone is a normal answer**, prefilled and stated in the UI. Not every call
moves a lead, and a wizard that implies otherwise gets stage data nobody should trust.

**Terminal stages disappear** for a salesperson unless `salesCanCloseLeads` is on. The action
re-checks and refuses rather than silently skipping the move — the review step promised it
would happen, so quietly dropping it would be a lie.

**The quick path.** One click logs "no answer" and pushes the date by
`QUICK_FOLLOW_UP_DAYS`, leaving the stage untouched — a phone that rang out teaches you nothing,
so four steps would be friction for no information. Its channel and outcome are resolved from
the live vocabulary by `resolveQuickFollowUp`, which the button label and the action both call,
so what it promises and what it writes cannot drift if an admin renames "No answer".

### Sorting the table by a custom field

Worth recording because it looks like it should need raw SQL and doesn't.

Prisma cannot `orderBy` a child row's value — but it can query *from* the child. Sorting on a
custom field queries `contact_field_values` with the contact filter nested inside it, which
keeps `buildContactVisibilityFilter` as the one gate on which contacts are reachable. A raw
`ORDER BY` would have stepped around that chokepoint, which is exactly the leak §2.4 exists to
prevent.

Contacts with no value row can't appear in that result at all, so they are fetched separately
and always placed **last in both directions** — "empty at the bottom" is what someone sorting a
column means, whichever way the arrow points. The two blocks are windowed against the page
offset rather than concatenated and sliced, so a page never silently loses rows.

---

## 9. Defects found, and what caused them

Recorded because each one has a general lesson.

### Column detection matched nothing

Exact-string header matching. Fixed with scored token matching (§7). *Lesson: test against a
deliberately messy real-world file, not a clean one you wrote yourself.*

### Contacts named after their email address

A blank name fell back to the raw address, producing a contact literally called
`julia@example.com`. Now derives a readable guess — "Julia" — and warns that it guessed.

### Moving the intake off `contacts` would have silently disabled the rate limiter

`isRateLimited` counted rows in `enquiries` matching the caller's IP hash, which was exactly
right while the website form created a contact and an enquiry directly. When the form was moved
to write to `submissions` instead, that count became permanently zero — every caller would have
read as "0 submissions this hour" and the two public endpoints would have been effectively
unlimited.

Nothing about it looks broken. No error, no failing request, no log line; just a defence that
stopped defending. It was caught by asking what *else* read the table the endpoint stopped
writing to, rather than by testing the endpoint, which passed either way.

Now counts `submissions` + `career_applications` against one shared budget — one budget because
an attacker does not care which of two endpoints they flood, and two allowances would simply
double what one address can send.

*Lesson: when a write moves to a new table, the thing to check is not the writer. It is every
reader that was counting on the old one.*

### Contact and Footer were modelled for sections that did not exist, and both guessed wrong

The two tables were designed ahead of the build, on the reasoning that having the copy ready
would speed the sections up. When the sections actually landed, Contact was wrong in five places
and Footer in two:

| Modelled | Built |
| --- | --- |
| `title_line_1` + `title_line_2` | one `CONTACT_TITLE` string |
| `eyebrow` | hardcoded in `ContactSection.tsx` — and written out twice |
| `email_address` | a link inside the footer's `Direct` group |
| three form labels, success + error | hardcoded in `EnquiryForm.tsx`; only `briefLabel` and `submitLabel` are props |
| flat `social` + `legal` link lists | one array of **titled groups**, feeding two footers |

Every wrong column would have become a field an editor could fill in that rendered nowhere —
the precise failure this panel's own rules warn about. Reshaped in `20260812000001`.

**It cost nothing only because it was caught early.** `contact_section`, `footer_content`, both
link tables and `content_releases` were all empty, so the fix is a `DROP TABLE` and a rebuild.
After one release the payload would have had to carry both shapes forever, since a release is
append-only and is what the site reads.

*Lesson: modelling copy ahead of the component that renders it is a guess, and it is a guess with
a shelf life. Do it if the section is genuinely blocked on the data — but reconcile it against the
real component the day it ships, while the tables are still empty.*

### The application seeds lost the space the applicant types after

`briefSeed` and `openApplicationSeed` are deliberately left mid-sentence — "…what I would want
to own: " — so the applicant continues them in the form. Every string in the panel is normalised
by `toPlainLine`, which trims; correct for all of them, and it ate that trailing space. The seed
round-tripped as "…would want to own:" and the applicant's first word would have joined it.

Caught by round-tripping the payload and printing the seed with a continuation appended, rather
than by reading the stored value — the defect is invisible in a text field and in a diff.

Fixed by making the space structural: `continuationSeed()` in `contentPayload.ts` adds it at
publish time. *Lesson: never make an editor type an invisible character. If a value needs
trailing whitespace to be correct, the code owes it, not the person.*

### `IDLE_IMPORT_STATE` was `undefined` on the client

A `"use server"` module turns **every** export into a server-function reference, so a plain
object exported from one arrives on the client as a stub, not a value. The build didn't reject
it, so it only appeared at runtime. Constants moved to `lib/leads/importState.ts`.

> **Rule: a `"use server"` file may only export async functions.** Shared constants and types
> belong in a plain module.

### The proxy would have swallowed lead submissions

Exempting the intake route from the session guard collided with the existing "already logged in →
go to dashboard" redirect, which would have bounced submissions to `/admin` whenever the caller
carried a session cookie — a 307 the caller reads as success. That redirect is now scoped to
the login page only. *Caught before shipping, by re-reading the guard rather than trusting it.*

### `prisma.leadSettings` undefined at runtime

Not a code bug — a stale process. `next dev` does not regenerate the Prisma client, and the
generated output lives outside the app directory, so a dev server started before a migration
holds a client without the new models. `build` and `postinstall` both regenerate; `dev` was
the gap. Now `"dev": "prisma generate && next dev"`.

### Hydration mismatch on `<body>`

`cz-shortcut-listen="true"`, injected by a browser extension (ColorZilla) before React
hydrates. Not application code. `suppressHydrationWarning` on `<body>` only — children still
hydrate normally, so a genuine mismatch inside the app is still reported.

---

## 10. Operations

```bash
npm run dev                 # regenerates the Prisma client, then starts
npm run build               # regenerates, then builds
npm run typecheck           # tsc --noEmit
npm run lint                # eslint directly (next lint is gone in 16)
npm run db:deploy           # apply migrations
npm run db:seed             # load the site's current copy (idempotent)
npm run db:bootstrap-admin  # promote existing Auth users with no team row to ADMIN
npm run db:studio
```

### Environment

`DATABASE_URL` is the **pooled** connection (6543, keep `?pgbouncer=true`); `DIRECT_URL` is
the **direct/session** one (5432) used by migrations and the seed. They are not
interchangeable — the transaction pooler cannot hold the session state DDL needs, and Prisma's
prepared statements fail intermittently on the pooler without the flag.

Use the **Session pooler** for `DIRECT_URL`, not "Direct connection": the direct host is
IPv6-only on most projects and fails on IPv4-only networks.

Percent-encode special characters in the password (`@` → `%40`, `&` → `%26`).

### First admin

Chicken-and-egg: you need an admin to make an admin. Create the first account in the Supabase
dashboard (Auto Confirm ticked), then `npm run db:bootstrap-admin`. Everyone after that is
added from the Team page, which creates their login for you.

---

## 11. What's deliberately missing

**The site is not connected.** Publishing stores a release and records the rebuild as
*skipped*. To connect it: add a revalidate route to the site, set `SITE_REVALIDATE_URL` and
`SITE_REVALIDATE_SECRET` here, and have the site read the newest `content_releases` row at
build time. The payload is already shaped for its existing types — the fields the CMS doesn't
own (`modelPath`, `profile`, `light`, `rock`) are simply absent, so the site keeps supplying
them from its own source.

**Section headings and nav copy** are still hardcoded in JSX (`ServicesDeck.tsx`,
`WorksField.tsx`, `FaqHologram.tsx`, `Navbar.tsx`, `heroReadouts.ts`) and must be extracted
into data files before a CMS can reach them. Two are structurally locked regardless: the hero
headline splits "worlds" around the shared 3D sun that `IntroSequence` flies into place, and
`NAV_ITEMS` keys drive scroll-progress CSS variables.

**Excluded from the CMS on purpose:** model paths, hull palettes, PBR values, per-ship lights,
model rotations, stage/camera tuning, and project rock geometry. Most are authored through the
in-app `?tune` GUI, which writes back to source files — putting them in a database would mean
two tools fighting over the same values.

### Known gaps

- **Lead export** — `salesCanExport` exists as a setting and `neutraliseFormula` is written
  and ready, but no export route is built yet. Formula neutralisation matters there because
  `=HYPERLINK(...)` in a note becomes an attack on whoever opens the CSV in Excel. The custom
  fields make this more valuable than it was, and more work: an export now has to resolve the
  column layout the same way the table does.
- **Phone numbers aren't matched.** `normalisePhone` exists, but identity is email-only, so
  the same person imported twice under two addresses won't be spotted.
- **Column widths are global.** One admin dragging a column resizes it for the whole team,
  which is the intended trade (§2.6's "one home" reasoning) but will feel wrong the first time
  two admins disagree.
- **No per-person view preferences.** The column layout is a team decision by design; if that
  turns out to be too blunt, the natural shape is an admin default with a per-member override,
  resolved as `override ?? default`.
- **Reports carry no money.** Nothing in the schema records what a deal is worth, so every figure
  on `/admin/reports` is a count. Win *rate* works; pipeline value, average deal size and revenue
  do not exist and are not faked. Adding them means an amount on the contact — and a team that
  actually fills it in, or the charts read zero.
- **A renamed stage drops out of historical win counts.** `contact_stage_changes` snapshots the
  stage *label* as text so that renaming a stage doesn't rewrite history (§2.5) — the cost is that
  "was this a win?" is answered by matching those snapshots against the labels currently marked
  WON. Storing the `kind` on each change alongside the label would fix it, and is the thing to add
  if renaming ever becomes common.
- **A published career role cannot be applied to.** The site's application form collects name,
  email, the work as a link or a PDF ≤ 5 MB, and "why you" — validates all of it, then prevents
  its own submit, because no endpoint exists. Roles are editable and publishable here; the
  receiving end is not built. It needs a multipart route that fails closed the way the intake
  does, storage for CVs, retention rules, and an inbox that is **not** the leads pipeline — a
  candidate is not a lead, and a CV is far more sensitive than an enquiry. Dropping a job
  application silently is worse than dropping an enquiry, because the person is left believing
  they applied.
- **The document pages' numbered sections are not editable.** `ABOUT_SECTIONS` and
  `CAREERS_SECTIONS` stay in the site's source, because each entry's `key` is simultaneously the
  section's anchor id and its station on the orbit rail. Making them editable means the CMS owns
  in-page navigation, and a renamed key breaks scroll targets with nothing to report it.
- **Authenticated pages have not been exercised in a browser** by automated checks — they
  typecheck, build, and route correctly, and the data layer is verified directly (including
  the custom-field sort ordering and the RLS lockdown), but the rendered logged-in UI has only
  been confirmed by hand.
- **`.env.example` is gitignored** by a later rule in `.gitignore` that overrides the
  `!.env.example` negation. It is meant to be committed.
- **No commits.** The repository still has no history.

---

## 12. Conventions

Shared with the site, since the two codebases are read together.

- **No abbreviations.** `currentUser`, not `u`. `serviceCapability`, not `cap`.
- **Files describe their contents** — `contentPayload.ts`, `plainText.ts`, never `utils.ts`.
  `.tsx` is PascalCase named after its component; `.ts` is camelCase.
- **Components live in a folder by category** (`components/ui`, `components/layout`).
- **Never hardcode a colour.** Use the tokens in `app/globals.css`.
- **Comments explain why**, not what. No JSDoc on every function.
- **Exports**: components default, everything else named.
- **No magic numbers** — named constants at the top of the file.

### The invariants worth protecting

1. A `"use server"` file exports only async functions.
2. Every Server Action re-checks auth itself.
3. Contact queries go through `lib/leads/visibility.ts`.
4. `contacts.email` is unique and lowercased — never create a second contact for a known email.
5. A new table gets RLS in the same migration that creates it.
6. Ordinals derive from `sortOrder`; they are never stored or typed.
7. The leads table's column layout has exactly one home, `lead_settings.leads_table_columns`.
8. Every query for a page of leads goes through `lib/leads/leadQuery.ts`, and every branch of
   it composes onto `buildContactVisibilityFilter` — including the custom-field sort.
9. A pipeline stage or custom field is retired, never deleted.
10. Every figure in `lib/leads/reports.ts` is built from `buildContactVisibilityFilter` too. An
    aggregate is the easiest place to leak a pipeline, because the number looks unremarkable and
    no name you shouldn't have seen ever appears on screen.
11. A contact is created with an origin or not at all — `contacts.origin_source` has no database
    default, so a new intake route fails to compile rather than guessing.

---

## 13. Reports

One page, `/admin/reports`, for both roles. Not two pages: the sections a salesperson needs are
the same sections an admin needs, scoped differently, and two implementations of "win rate" is
two numbers that eventually disagree. `visibility.ts` does the scoping, so a salesperson opening
it sees their own pipeline without a single role check in the page.

**Ordered by who is reading.** A salesperson opens it to find out what needs chasing, so hygiene
leads. An admin opens it to find out how the team is doing, so the headline figures lead and
hygiene closes. Same sections, same queries — different first thing your eye lands on.

**Intake counts by when a lead arrived; outcomes count by when they happened.** "31 new leads"
means created in the window. "12 won" means moved into a Won stage during the window, whenever
the lead first arrived. Each figure then answers the question it appears to answer. The
alternative — counting everything by arrival date — makes every recent period look empty, because
most of its leads have not been decided yet.

**Sales see only their own numbers**, with no team average to compare against. That was a
deliberate choice rather than an oversight: it is the one place in the panel that could tell a
salesperson how everybody else is doing, and turning that on is a management decision.

**An admin can narrow the whole page to one person.** The filter can only ever *narrow* — for
Sales it is ignored outright, because their visibility filter has already decided and a posted
`ownerId` must not become a way around it. Verified directly: a salesperson requesting the
admin's id gets their own five leads, not the admin's eleven.

**Wins count for whoever owns the lead now**, not whoever moved it. That keeps the reports and
the leads list's Owner column telling one story, and stops an admin closing a deal on somebody's
behalf from taking the win off them.

### The charts

Colour is computed, not chosen. The ramp in `--chart-1..6` is *ordinal* — one hue, six steps,
monotone lightness, validated against the `--card` surface these render on (every adjacent gap
≥ 0.06 OKLCH L, dimmest step still 3.5:1). It encodes position in the pipeline and nothing else.

**The ramp was re-derived in amber when the site's accent stopped being cyan**, and the
re-derivation is the argument for computing it. The obvious move — keep the cyan ramp's six
lightness targets, swap the hue — *fails*: amber carries less relative luminance than cyan at
equal OKLCH lightness, so the dimmest step measured 3.25:1 on the card instead of the 3.52:1 the
cyan step gave, and quietly dropped under the floor. The floor was solved for instead (L 0.537,
3.63:1) and the six steps redistributed evenly above it. Eyeballing the swap would have shipped a
ramp whose last stage was unreadable on the surface it renders on.

**`--warning` had to leave amber in the same change.** It was `#ffb24d`, which is exactly the
site's `--heat-800` — fine beside a cyan accent, 14.5° away in hue from an amber one. Both are
used as small text and hairlines (the unpublished-changes badge, the import wizard's "Already
here" row, the near-limit counter), so two status colours became one. It moved to yellow at h100,
44° clear. The lesson generalises: a brand colour moving does not only cost the tokens that
*alias* it, it costs every token that was merely far enough away from the old one.

Three rules fall out of that, and each one is a mistake avoided rather than a preference:

- **Stages are ordinal, so they take the ramp.** Swapping Qualified and Proposal changes the
  meaning, so the order is real and the colour should show it.
- **Sources are nominal, so every bar is the same colour.** Swapping "By hand" and "Imported"
  changes nothing. Colouring them differently — or worse, shading them by value — spends the one
  free channel re-encoding what bar length already says.
- **Won and Lost never join the ramp.** They mean good and bad, so they wear `--success` and
  `--danger`, and a status colour must never double as a series.

No value depends on hovering: bars are direct-labelled and the trend carries a table underneath.
Deltas pair an arrow with the colour, so direction is never carried by hue alone.

---

## 14. The panel's layout

**Pages declare their own width.** The shell used to cap everything at 768px, which meant the
leads table was capped at 768px too — its default columns alone come to ~974px, so it opened
already scrolled. Prose and forms wrap in `ReadingColumn`; tables and reports use the shell.

**The sidebar earns its 240px from 1024px up.** Below that it is a horizontal strip along the
top. On a tablet, a third of the screen spent on eight links is a third the table needed more.

**The table scrolls sideways; the page scrolls down.** The two are exclusive and the reason is
worth writing down, because it will come up again: `position: sticky` resolves against the
nearest scrolling ancestor. Give the table its own scrollbox and the column headings stick to the
box, not the window — but hand that overflow to the page instead, and reaching the last column
drags the heading, the tabs and the search box off to the left with it. The scrollbox won; the
sticky headings were the price, and the pinned Name column is what it bought back.

**The table is as tall as its rows.** Never `flex-1`, which stretches a five-row table into a box
half full of nothing, and never its own vertical scrollbar. `overflow-y-hidden` on the box is
deliberate: a horizontal scrollbar eats ~15px inside it, which pushes the last row past the
bottom edge and summons a vertical scrollbar to reveal 15px of nothing.

**Below 640px the rows become cards.** A ten-column table does not survive a 375px screen. The
cards show a fixed set of fields rather than the admin's column layout — a card is a summary you
scan to find the right person, and the whole record is one tap away.
