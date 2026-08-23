# The site's mark builder, vendored

**Nothing in this folder is this repo's code.** Every `.ts` file here is a byte-for-byte copy of one
in `orbix-dev` under `components/sections/WorksField/`. Do not edit them here. Fix the site, then
run `npm run marks:sync-vendor`.

## Why the copies exist

The works section does not draw a project's SVG. It cuts the outlines into interlocking stones,
grows them out of a rock and overgrows the result with geode — `createAccretionMark` and everything
under it. So "how will this mark look?" has exactly one honest answer, and it is that builder's.

The two repos share no package, so the choice was between vendoring the builder and re-implementing
it. A re-implementation drifts silently and cannot be re-synced; a verbatim copy can be diffed with
a hash and re-copied with `cp`. Hence this folder, and hence
`scripts/checkVendoredMarkPipeline.ts`.

```
npm run marks:check-vendor   # do the copies still match ../orbix-dev?
npm run marks:sync-vendor    # re-copy them, then typecheck and LOOK at a preview
```

Both take `VOIDIX_SITE_PATH` if the site is not a sibling checkout, and the check skips (rather than
fails) when it cannot find one — a CI box with only this repo has nothing to compare against.

## What is vendored

The module list lives in `vendoredFiles.ts`, which both scripts read so they cannot disagree. It
also covers `lib/coolPalette.ts` at the repo root, because these files import it as
`@/lib/coolPalette` and moving it would mean editing a file that may not be edited.

Three assets under `public/` are vendored too and are **not** in that list — they are binaries that
change perhaps once a year, and hashing half a megabyte on every check is not the trade:

| Panel path | Site path | Used by |
| --- | --- | --- |
| `public/textures/meteor/black-stone-background-material_1127-22469.jpg` | same | the stone's surface |
| `public/textures/geode/geode-druse.webp` | same | what an opened cavity shows |
| `public/fonts/helvetiker_bold.typeface.json` | same | the initial a project with no mark grows |

The paths matter: `accretionTransition.ts` loads the first two by absolute URL, and it is vendored,
so the panel has to serve them from where the site serves them.

## What is *not* vendored

The rig — renderer, camera, lights, environment, bloom, tone mapping. That lives in
`lib/content/markPreviewScene.ts` and is this repo's own code, because the site's is 3,472 lines of
scroll choreography, adaptive resolution and a two-stage composer feeding a reveal, and the preview
needs none of it. Its *look* constants are copied across with comments pointing at their source —
those are the numbers to re-check if a preview stops matching the section while every file here
still hashes clean.
