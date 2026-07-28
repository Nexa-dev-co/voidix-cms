<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# voidix-cms

Content control panel for the voidix site (`../orbix-dev`, repo `Nexa-dev-co/orbix-dev`). It
edits **text only** — three sections, Services / Works / FAQ. See `README.md` for what it
deliberately cannot do and why.

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

## Architecture

**Draft and release are separate layers.** The tables (`services`, `projects`, `faq_entries`
plus ordered child tables) are the working draft. Publishing serialises the whole draft into
one append-only `content_releases` row shaped exactly like the site's TypeScript arrays. Never
mutate an existing release; publish writes a new version. The site (once wired) reads the
newest release, never the draft tables.

**Every Server Action re-checks auth.** `requireUser()` at the top of each one. The proxy
guards page routes, but Server Actions are reachable by direct POST and do not go through it.

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
