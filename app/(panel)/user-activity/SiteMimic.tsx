import type { LayoutRegion, RegionRole, SectionLayout } from "@/lib/journey/sectionLayouts";

/**
 * The site's scene, redrawn from `sectionLayouts` — the reference the heat sits on.
 *
 * ── ⚠ IT IS SET IN THE SITE'S OWN TYPE, ON THE SITE'S OWN SUBSTRATE ────────────────────────────
 * The panel already loads Syne and DM Sans for its own chrome, which is the only reason this is
 * affordable. A mimic in the wrong face is a wireframe, and a wireframe is much harder to match
 * against your memory of the page — which is the entire job here. The hero renders CREAM because the
 * hero *is* cream; drawing it dark would hide the one place the amber heat ramp genuinely struggles.
 *
 * ── ⚠ THE 3D MODELS ARE OUTLINES WITH A NAME, DELIBERATELY ─────────────────────────────────────
 * The sun, the craft, the mark, the plinth and the black hole are the loudest things on the real
 * page and they are all AMBER. Reproducing them — even as a gradient — would put the measurement's
 * only colour into the background, and a reader could no longer tell which orange was the data.
 * An outline holds the silhouette and the position, which is all a reference frame owes.
 *
 * ── ⚠ IT MUST NOT EAT THE POINTER ──────────────────────────────────────────────────────────────
 * `pointer-events-none` on the root. The detail page puts a transparent hit-testing grid ON TOP of
 * this, and a mimic that swallowed the pointer would silently kill every tooltip.
 *
 * ⚠ Everything is positioned in PERCENTAGES, never pixels, so one component serves the small card
 * and the full-width detail page. The frame's own aspect ratio is the caller's business — see
 * `viewports` on `SectionHeatmap` for why it is not always 16:9.
 */

/** Type scales, in container-query units so the mimic reads at any width. See the `cq` note below. */
const ROLE_CLASSES: Record<RegionRole, string> = {
  eyebrow: "font-sans uppercase tracking-[0.18em] opacity-55",
  title: "font-display font-extrabold leading-[1.05] tracking-tight",
  body: "font-sans leading-snug opacity-60",
  label: "font-sans opacity-55",
  pill: "font-sans opacity-70",
  action: "font-sans uppercase tracking-[0.1em]",
  field: "font-sans opacity-55",
  object: "font-sans uppercase tracking-[0.14em] opacity-45",
};

/**
 * ⚠ `cqw`, not `rem`. This same component renders in a half-column card and on a full-width page,
 * and type fixed in absolute units would be unreadable in one and absurd in the other. Sized against
 * the container so the mimic scales as one piece.
 */
const ROLE_SIZES: Record<RegionRole, string> = {
  eyebrow: "0.9cqw",
  title: "2.6cqw",
  body: "1cqw",
  label: "0.95cqw",
  pill: "0.95cqw",
  action: "0.95cqw",
  field: "1cqw",
  object: "1cqw",
};

export default function SiteMimic({
  layout,
  showText = true,
}: {
  layout: SectionLayout;
  /**
   * ⚠ Off on the small card. Below roughly 30rem the copy renders at a couple of pixels and turns
   * into grey mush that reads as noise over the data — the outlines alone still carry the geometry,
   * which is what the card needs. The detail page turns it on.
   */
  showText?: boolean;
}) {
  const isCream = layout.substrate === "cream";

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        // The substrate itself. Sits under the heat, which is why it is flat rather than lit.
        backgroundColor: isCream ? "#e2dfd2" : "#060606",
        color: isCream ? "#1a1613" : "#ebe8e0",
      }}
      aria-hidden="true"
    >
      {/* The nav's hairline, which is the one piece of site chrome that is a line rather than a box. */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ backgroundColor: isCream ? "rgb(0 0 0 / 0.12)" : "rgb(255 138 26 / 0.25)" }}
      />

      {layout.regions.map((region) => (
        <Region
          key={`${region.label} ${region.x} ${region.y}`}
          region={region}
          isCream={isCream}
          showText={showText}
        />
      ))}
    </div>
  );
}

function Region({
  region,
  isCream,
  showText,
}: {
  region: LayoutRegion;
  isCream: boolean;
  showText: boolean;
}) {
  const isObject = region.role === "object";
  const isAction = region.role === "action";
  const align = region.align ?? "left";

  return (
    <div
      className={`absolute overflow-hidden ${isObject || isAction ? "rounded-full" : ""}`}
      style={{
        left: `${region.x}%`,
        top: `${region.y}%`,
        width: `${region.width}%`,
        height: `${region.height}%`,
        // ⚠ Only objects and actions carry a border. Copy on the real site has no box around it, and
        // outlining every paragraph is what makes a mimic look like a wireframe.
        border: isObject
          ? `1px dashed ${isCream ? "rgb(0 0 0 / 0.22)" : "rgb(235 232 224 / 0.18)"}`
          : isAction
            ? "1px solid rgb(255 138 26 / 0.45)"
            : undefined,
        borderRadius: isObject ? "6%" : undefined,
      }}
    >
      <div
        className={`flex h-full w-full ${ROLE_CLASSES[region.role]} ${
          isObject ? "items-center justify-center" : "items-start"
        }`}
        style={{
          fontSize: ROLE_SIZES[region.role],
          justifyContent:
            align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
          textAlign: align,
          // The accent is the site's amber, and only the things that are amber on the site get it.
          color: isAction ? "#ff8a1a" : undefined,
          padding: "0.3cqw 0.5cqw",
          whiteSpace: "pre-line",
        }}
      >
        {showText ? (region.text ?? region.label) : isObject ? region.label : ""}
      </div>
    </div>
  );
}
