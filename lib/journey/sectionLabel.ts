/**
 * A section key, as a human should read it.
 *
 * ⚠ NOT A CSS `capitalize`, which is what this used to be. A document route's section key is a DOM
 * id doing double duty as a label — `the-studio`, `how-we-work` — and no text-transform turns a
 * hyphen into a space, so the raw id was reaching the page. The homepage's keys (`hero`, `work`)
 * happen to survive `capitalize` intact, which is exactly why the gap went unnoticed until the
 * document routes started reporting sections at all.
 */
export function humanise(key: string): string {
  const spaced = key.replace(/-/g, " ").trim();

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
