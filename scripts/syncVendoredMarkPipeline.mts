import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { VENDORED_MARK_FILES } from "../lib/content/siteWorksField/vendoredFiles";

/**
 * Re-copies the site's mark pipeline into this panel.
 *
 * The other half of `checkVendoredMarkPipeline.ts` — read its header first; it explains why there
 * are copies at all. This exists so re-syncing is one command rather than ten `cp`s, because a
 * partial re-sync is the worst state of the three: the preview then builds half of one renderer and
 * half of another, and typechecks.
 *
 * Run with:  npm run marks:sync-vendor
 *
 * ⚠ `.mts` for the same reason as its sibling — see the note in `checkVendoredMarkPipeline.mts`.
 *
 * ⚠ Copying is the easy half. Afterwards:
 *   1 · `npm run typecheck` — a new import in the site's builder shows up here as a missing module,
 *       and that file needs vendoring too (add it to `vendoredFiles.ts`).
 *   2 · Open a project's mark preview and look at it. The pipeline reads two textures and a
 *       typeface from `public/`, which this does not copy — see the README.
 */

const SITE_PATH_VARIABLE = "VOIDIX_SITE_PATH";
const DEFAULT_SITE_PATH = "../orbix-dev";

const panelRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = resolve(panelRoot, process.env[SITE_PATH_VARIABLE] ?? DEFAULT_SITE_PATH);

async function main(): Promise<void> {
  for (const file of VENDORED_MARK_FILES) {
    const destination = join(panelRoot, file.panelPath);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(siteRoot, file.sitePath), destination);
    console.log(`  copied  ${file.panelPath}`);
  }

  console.log(
    `\nCopied ${VENDORED_MARK_FILES.length} files from ${siteRoot}.\n` +
      "Now run `npm run typecheck`, then open a mark preview and look at it.",
  );
}

await main();
