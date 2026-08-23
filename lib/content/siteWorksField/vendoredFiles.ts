/**
 * Every file in this panel that is a VERBATIM COPY of one in the site repo, and where it came from.
 *
 * ── ⚠ NOTHING HERE MAY BE EDITED IN THIS REPO ───────────────────────────────────────────────────
 * These are the site's own mark builder — `createAccretionMark` and the modules under it — copied so
 * the panel's preview grows the same stones the works field does. The moment one of them is edited
 * here, the preview stops being a preview and becomes a second renderer that merely resembles the
 * first. Fix it in `orbix-dev` and copy it back across.
 *
 * The list is a module rather than a hardcoded array in the script because the sync script and the
 * check script must not be able to disagree about what is vendored.
 *
 * ⚠ Adding a file here is not enough on its own: if the site's builder grows a new import, `tsc`
 * will fail on the missing module and that is the signal to copy it and add it to this list.
 *
 * The two TEXTURES and the typeface under `public/` are vendored too and are deliberately NOT in
 * this list — they are binaries that change perhaps once a year, and hashing 470 KB on every check
 * to catch that is not the trade. They are named in the README beside this file.
 */

export interface VendoredFile {
  /** Path inside this repo, from its root. */
  panelPath: string;
  /** Path inside the site repo, from its root. */
  sitePath: string;
}

const SITE_WORKS_FIELD = "components/sections/WorksField";
const PANEL_WORKS_FIELD = "lib/content/siteWorksField";

function fromWorksField(relativePath: string): VendoredFile {
  return {
    panelPath: `${PANEL_WORKS_FIELD}/${relativePath}`,
    sitePath: `${SITE_WORKS_FIELD}/${relativePath}`,
  };
}

export const VENDORED_MARK_FILES: VendoredFile[] = [
  // ⚠ Vendored to `lib/coolPalette.ts` and not into the folder with the rest, because the site's
  // modules import it as `@/lib/coolPalette` and the copies are byte-identical. Moving it would mean
  // editing an import in a file this list says may not be edited.
  { panelPath: "lib/coolPalette.ts", sitePath: "lib/coolPalette.ts" },

  fromWorksField("markBody.ts"),
  fromWorksField("markCapMesh.ts"),
  fromWorksField("markContours.ts"),
  fromWorksField("markRockField.ts"),
  fromWorksField("meteorBody.ts"),
  fromWorksField("transitions/markTransition.ts"),
  fromWorksField("transitions/accretionChunks.ts"),
  fromWorksField("transitions/accretionCrystals.ts"),
  fromWorksField("transitions/accretionGrowth.ts"),
  fromWorksField("transitions/accretionTransition.ts"),
];
