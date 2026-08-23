import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { VENDORED_MARK_FILES } from "../lib/content/siteWorksField/vendoredFiles";

/**
 * Is this panel's copy of the site's mark pipeline still the site's?
 *
 * ── ⚠ WHY THERE IS A COPY AT ALL ────────────────────────────────────────────────────────────────
 * The mark preview shows an editor the stones the works field will actually grow, which means
 * running the site's builder — `createAccretionMark` and everything under it. Two repos, no
 * package between them, so the modules are VENDORED VERBATIM rather than re-implemented. A
 * verbatim copy can be re-synced with `cp`; a paraphrase drifts silently and cannot.
 *
 * The cost of that decision is exactly this script. Without it the panel would keep showing a
 * preview of a renderer the site has since changed — a preview that is confidently wrong, which is
 * worse than no preview, because an editor has no way to tell.
 *
 * Run with:  npm run marks:check-vendor
 *
 * ⚠ `.mts`, not `.ts`. This package has no `"type": "module"`, so tsx compiles a `.ts` script to
 * CommonJS — where the top-level await below is a syntax error and `import.meta.url` has no meaning.
 *
 * ⚠ It compares bytes, not behaviour. A file reported as drifted is not necessarily broken — it
 * means the site moved and this copy has not. Re-copy it (`npm run marks:sync-vendor`), typecheck,
 * and look at the preview before trusting it again.
 *
 * The site repo is a sibling checkout by default. Point `VOIDIX_SITE_PATH` at it if yours is not,
 * and the script SKIPS rather than fails when it cannot find one: a CI box that checks out this
 * repo alone has nothing to compare against, and a red build there would only teach people to
 * ignore it.
 */

const SITE_PATH_VARIABLE = "VOIDIX_SITE_PATH";
const DEFAULT_SITE_PATH = "../orbix-dev";

const panelRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sitePath = process.env[SITE_PATH_VARIABLE] ?? DEFAULT_SITE_PATH;
const siteRoot = resolve(panelRoot, sitePath);

type Comparison =
  | { kind: "identical" }
  | { kind: "drifted" }
  | { kind: "missing"; side: "panel" | "site" };

async function hashOrNull(path: string): Promise<string | null> {
  try {
    // Read as bytes rather than as text: a line-ending change is a real difference here, and
    // normalising it away would hide the one kind of drift `cp` itself can introduce.
    const contents = await readFile(path);
    return createHash("sha256").update(contents).digest("hex");
  } catch {
    return null;
  }
}

async function compare(panelFile: string, siteFile: string): Promise<Comparison> {
  const [panelHash, siteHash] = await Promise.all([
    hashOrNull(join(panelRoot, panelFile)),
    hashOrNull(join(siteRoot, siteFile)),
  ]);

  if (panelHash === null) return { kind: "missing", side: "panel" };
  if (siteHash === null) return { kind: "missing", side: "site" };
  return panelHash === siteHash ? { kind: "identical" } : { kind: "drifted" };
}

async function main(): Promise<void> {
  const siteExists = (await hashOrNull(join(siteRoot, "package.json"))) !== null;

  if (!siteExists) {
    console.log(
      `No site checkout at ${siteRoot} — skipping. Set ${SITE_PATH_VARIABLE} if it lives elsewhere.`,
    );
    return;
  }

  const results = await Promise.all(
    VENDORED_MARK_FILES.map(async (file) => ({
      file,
      comparison: await compare(file.panelPath, file.sitePath),
    })),
  );

  let problems = 0;

  results.forEach(({ file, comparison }) => {
    if (comparison.kind === "identical") {
      console.log(`  ok       ${file.panelPath}`);
      return;
    }

    problems += 1;

    if (comparison.kind === "missing") {
      console.log(`  MISSING  ${file.panelPath} — not found in the ${comparison.side} repo`);
      return;
    }

    console.log(`  DRIFTED  ${file.panelPath}`);
    console.log(`           site: ${join(siteRoot, file.sitePath)}`);
  });

  if (problems === 0) {
    console.log(`\nAll ${results.length} vendored files match ${siteRoot}.`);
    return;
  }

  console.log(
    `\n${problems} of ${results.length} vendored files no longer match the site.\n` +
      "The mark preview is now showing something the works field does not build.\n" +
      "Re-sync with:  npm run marks:sync-vendor",
  );
  process.exitCode = 1;
}

await main();
