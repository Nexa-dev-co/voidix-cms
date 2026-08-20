import type { HeatmapLayout } from "@/lib/journey/activityReport";

/**
 * A mimic of each of the site's scenes — the furniture, where it sits, and what it says.
 *
 * ── ⚠ WHY THIS IS A MIMIC AND NOT SCREENSHOTS ──────────────────────────────────────────────────
 * Screenshots were the obvious answer and are the wrong one, for four reasons that only became
 * visible with the real frames in hand:
 *
 *   1 · SERVICES AND WORK ARE FOUR-STOP CAROUSELS. Any screenshot is one craft or one project. The
 *       arrangement, though, is identical across all four stops — title left, subject centre, detail
 *       panel right, strip along the bottom — so a mimic describes every stop at once while a
 *       photograph describes one and misleads about three.
 *   2 · THE HERO IS CREAM. `#e2dfd2`, not black. An amber heat field over it is the exact contrast
 *       failure the site's own colour rules warn about — raw `#ff8a1a` is 1.77:1 there. Real frames
 *       would need a different heat ramp per section chosen by substrate.
 *   3 · THE 3D FIGHTS THE DATA. Works puts a glowing amber mark through the middle of the frame.
 *       Overlay an amber heat field and you cannot tell which orange is the measurement. Here the
 *       models are `object` regions — an outline with a name — so they hold their place and their
 *       silhouette without competing for the only colour that carries meaning.
 *   4 · A BOX CAN CARRY A NAME. "That blob is over the detail panel" is the whole point.
 *
 * ── ⚠ IT USES THE SITE'S OWN TWO TYPEFACES ─────────────────────────────────────────────────────
 * The panel already loads Syne and DM Sans, for exactly the reason this needs them: a mimic set in
 * the wrong face is a diagram, and a diagram is harder to match against your memory of the page.
 * `role` below drives the typography so the mimic reads as the scene rather than as a wireframe.
 *
 * ── ⚠ THIS IS SITE KNOWLEDGE LIVING IN THE PANEL, WHICH IS A DRIFT HAZARD ──────────────────────
 * Same class of risk as a selector-to-label lookup table, accepted for one reason: it is COARSE.
 * A handful of boxes per scene, positioned to the nearest percent, describing an arrangement that
 * has been stable across the site's whole life. A copy change makes a label stale, not wrong; only a
 * redesign invalidates it, and a redesign is when somebody should be re-cutting these anyway.
 *
 * ⚠ Keep it coarse. The moment this file starts naming individual buttons it has become the lookup
 * table `sectionLabel.ts` refuses to be, and it will rot the same way.
 *
 * ── ⚠ WIDE ONLY, AND DELIBERATELY SO ──────────────────────────────────────────────────────────
 * Every region was measured from a 1919×1079 capture of the WIDE layout. Below `51.25em` the site
 * renders something genuinely different — the nav becomes an orbit fan, copy moves into a bottom
 * sheet — and no capture of that exists. So `narrow` heatmaps render with NO mimic rather than
 * against a fabricated one. An invented layout would be worse than none: it would look authoritative.
 */

/**
 * How a region is set. This is the whole reason the mimic reads as the site rather than as a
 * wireframe — the site's hierarchy is carried by type, so the mimic's has to be too.
 */
export type RegionRole =
  /** Tiny uppercase kicker: "THE FLEET", "SELECTED WORK". */
  | "eyebrow"
  /** Display type, Syne. The thing you read first. */
  | "title"
  /** Body copy, DM Sans, muted. */
  | "body"
  /** A small label — nav items, HUD readouts, footer links. */
  | "label"
  /** A bordered chip: capability tags, the counter. */
  | "pill"
  /** A call to action — amber border, amber text. */
  | "action"
  /** A form field: a faint label above a rule. */
  | "field"
  /** ⚠ A 3D MODEL'S STAND-IN. Outline plus a centred name, never a fill — see the header. */
  | "object";

export interface LayoutRegion {
  /** What this is, for the tooltip and for the reader. */
  label: string;
  /** What the site actually says here, when it is worth setting. Falls back to `label`. */
  text?: string;
  /** Percentages, 0–100, from the top-left of the viewport. */
  x: number;
  y: number;
  width: number;
  height: number;
  role: RegionRole;
  /** Horizontal alignment inside the box. Centre for anything the site centres. */
  align?: "left" | "center" | "right";
}

export interface SectionLayout {
  /** ⚠ Matches a section KEY, not a title. `work`, never `works`. */
  section: string;
  /**
   * ⚠ The site's two substrates, and the mimic has to honour both. The hero is the ONLY light scene;
   * everything downstream of it is near-black. Rendering the hero dark would misrepresent the one
   * place where the heat ramp genuinely struggles.
   */
  substrate: "dark" | "cream";
  regions: LayoutRegion[];
}

/**
 * ⚠ The navigation bar is identical in all five scenes, so it is defined once. It is also the single
 * most-hovered strip on the site, which makes it the first thing a reader needs to rule out when
 * they see heat along the top edge.
 */
const NAV_REGIONS: LayoutRegion[] = [
  { label: "Wordmark", text: "VOIDIX", x: 3.4, y: 2, width: 9, height: 4, role: "label" },
  { label: "Nav · Services", text: "Services", x: 33, y: 2, width: 8, height: 4, role: "label" },
  { label: "Nav · Work", text: "Work", x: 43, y: 2, width: 7, height: 4, role: "label" },
  { label: "Nav · FAQ", text: "FAQ", x: 51.5, y: 2, width: 6, height: 4, role: "label" },
  { label: "Nav · Contact", text: "Contact", x: 59, y: 2, width: 8, height: 4, role: "label" },
  { label: "Start project", text: "Start Project ↗", x: 88.5, y: 1.8, width: 9, height: 4.5, role: "action" },
];

const SECTION_LAYOUTS: SectionLayout[] = [
  {
    section: "hero",
    // ⚠ The ONLY light scene on the site. See `substrate` — the heat ramp was graded on black.
    substrate: "cream",
    regions: [
      ...NAV_REGIONS,
      { label: "Instrument column", text: "CORE STATUS · MISSION · STABILITY", x: 3.4, y: 21, width: 10, height: 44, role: "label" },
      { label: "Instrument column", text: "GRAVITY · CURSOR · PORTAL", x: 87, y: 29, width: 10, height: 43, role: "label", align: "right" },
      { label: "Headline", text: "we build W  rlds", x: 27, y: 33, width: 46, height: 25, role: "title", align: "center" },
      { label: "The sun", x: 41, y: 44, width: 10.5, height: 18, role: "object", align: "center" },
      { label: "Scroll cue", text: "SCROLL TO EXPLORE ↓", x: 3.4, y: 69, width: 7, height: 9, role: "label" },
      { label: "Tagline", text: "SOFTWARE WITH ITS OWN GRAVITY", x: 38, y: 93.5, width: 24, height: 3, role: "label", align: "center" },
    ],
  },
  {
    section: "services",
    substrate: "dark",
    regions: [
      ...NAV_REGIONS,
      { label: "Eyebrow", text: "THE FLEET", x: 4.6, y: 12, width: 12, height: 2.5, role: "eyebrow" },
      { label: "Section title", text: "One craft at a time. Bring it online.", x: 4.6, y: 16, width: 25, height: 23, role: "title" },
      { label: "The sun", x: 45.6, y: 22.7, width: 8.4, height: 14.3, role: "object", align: "center" },
      { label: "The craft", x: 38, y: 42, width: 25, height: 18, role: "object", align: "center" },
      { label: "Craft title", text: "Interfaces with escape velocity", x: 76.5, y: 13, width: 19, height: 7, role: "title" },
      { label: "Craft description", text: "Bespoke platforms engineered from the metal up — no templates, no compromise.", x: 76.5, y: 21.5, width: 19, height: 12, role: "body" },
      { label: "Capability tags", text: "Next.js · WebGL · Realtime", x: 76.5, y: 34, width: 19, height: 6, role: "pill" },
      { label: "Craft CTA", text: "START THIS BUILD →", x: 76.5, y: 43, width: 19, height: 5, role: "action", align: "center" },
      { label: "Craft strip", text: "01 Web  ·  02 Mobile  ·  03 Enterprise  ·  04 AI", x: 23.5, y: 88, width: 53, height: 6, role: "label", align: "center" },
    ],
  },
  {
    section: "work",
    substrate: "dark",
    regions: [
      ...NAV_REGIONS,
      { label: "Eyebrow", text: "SELECTED WORK", x: 4.6, y: 12, width: 14, height: 2.5, role: "eyebrow" },
      { label: "Section title", text: "Four fires. One field.", x: 4.6, y: 16, width: 25, height: 12, role: "title" },
      { label: "The mark", x: 36, y: 30, width: 30, height: 60, role: "object", align: "center" },
      { label: "Discipline tag", text: "MOBILE DEVELOPMENT", x: 76.5, y: 12, width: 19, height: 4, role: "pill" },
      { label: "Project title", text: "Meridian", x: 76.5, y: 17, width: 19, height: 6, role: "title" },
      { label: "Project description", text: "One record that follows the patient, not the department.", x: 76.5, y: 24, width: 19, height: 12, role: "body" },
      { label: "Project CTA", text: "START ONE LIKE THIS →", x: 76.5, y: 46, width: 19, height: 5, role: "action", align: "center" },
      { label: "Arrows & counter", text: "←  02 / 04  →", x: 43.5, y: 91, width: 13, height: 4, role: "label", align: "center" },
    ],
  },
  {
    section: "faq",
    substrate: "dark",
    regions: [
      ...NAV_REGIONS,
      { label: "Panel eyebrow", text: "FREQUENCIES", x: 32, y: 15, width: 14, height: 3, role: "eyebrow" },
      { label: "Question panel", text: "01 What do you actually build?\n02 How long does a build take?\n03 What does it cost?\n04 Do you work alongside a team?\n05 What happens after launch?", x: 29.7, y: 10, width: 41.3, height: 49, role: "body" },
      { label: "Ask us anything", text: "Ask us anything →", x: 44.8, y: 62.5, width: 11.5, height: 5, role: "action", align: "center" },
      { label: "The plinth", x: 44.8, y: 68, width: 11.2, height: 19, role: "object", align: "center" },
    ],
  },
  {
    section: "contact",
    substrate: "dark",
    regions: [
      ...NAV_REGIONS,
      { label: "Eyebrow", text: "04 — START A PROJECT", x: 4.6, y: 35, width: 18, height: 2.5, role: "eyebrow" },
      { label: "Section title", text: "Tell us what you are building.", x: 4.6, y: 38, width: 25, height: 11, role: "title" },
      { label: "Lead paragraph", text: "A paragraph is enough — what it is, who it is for, and what has to be true on the day it ships.", x: 4.6, y: 47.5, width: 25, height: 8, role: "body" },
      { label: "The black hole", x: 24, y: 42, width: 52, height: 20, role: "object", align: "center" },
      { label: "Enquiry form", text: "Name\nPhone\nEmail *\nWhat you are building", x: 64.6, y: 19.5, width: 30.8, height: 42, role: "field" },
      { label: "Send it", text: "SEND IT", x: 67, y: 61.5, width: 6.5, height: 4.5, role: "action", align: "center" },
      { label: "Travel in time", text: "TRAVEL IN TIME", x: 44.5, y: 77.5, width: 11, height: 4.5, role: "action", align: "center" },
      { label: "Footer", text: "Voidix · About · Careers · hello@voidix.studio · Privacy", x: 4.6, y: 86, width: 90.8, height: 9, role: "label" },
    ],
  },
];

/**
 * The mimic for one heatmap, or null when there is none to give.
 *
 * ⚠ Null for a NARROW or UNKNOWN layout, and for any section not on the homepage. Returning the wide
 * layout for a narrow heatmap would draw a confident, wrong picture — the failure the whole v4
 * change exists to prevent.
 */
export function findSectionLayout(
  section: string,
  route: string,
  layout: HeatmapLayout,
): SectionLayout | null {
  // ⚠ `wide` is `wide` whether it was measured or recovered from the session's `device:profile`.
  // The caller marks an inferred frame in the UI; refusing to draw one at all was the behaviour
  // that left every historical picture with no reference whatsoever, which is true and useless.
  if (layout !== "wide") return null;
  // The document routes have their own stations and no authored geometry.
  if (route !== "/") return null;

  return SECTION_LAYOUTS.find((candidate) => candidate.section === section) ?? null;
}
