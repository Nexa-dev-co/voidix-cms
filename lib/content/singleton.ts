/**
 * Primary key for the single-row tables (contact_section, footer_content).
 *
 * These tables describe one thing each — there is one contact section and one footer — so
 * rather than a uuid nobody can predict, they use a fixed key. That makes every write an
 * `upsert` on a known id, which cannot produce a second row the way create-if-missing can
 * under a race.
 */
export const SINGLETON_ROW_ID = "singleton";
