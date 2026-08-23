import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // ⚠ Verbatim copies of the site's mark builder — see lib/content/siteWorksField/README.md.
    // Linted in orbix-dev, where they can actually be fixed. Reporting them here would mean a
    // permanent warning nobody in this repo is allowed to act on, which is how lint output stops
    // being read at all.
    "lib/content/siteWorksField/**",
    "lib/coolPalette.ts",
  ]),
]);

export default eslintConfig;
