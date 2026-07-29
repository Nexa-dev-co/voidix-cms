/**
 * Turns an email into a usable display name when a file has no name column.
 *
 * The first version fell back to the raw address, which is how a contact ended up literally
 * called "julia@example.com". This reads the local part instead and title-cases it, so
 * `julia.roberts@corp.com` becomes "Julia Roberts" — a guess, but a legible one that a
 * salesperson can correct, rather than something nobody would ever type as a name.
 */
export function deriveNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "";

  const words = localPart
    .replace(/[._\-+]+/g, " ")
    // Drop the digits vendors staple on: "sarah.vance92" → "sarah vance".
    .replace(/\d+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return email;
  }

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * A comparable form of a phone number: digits only, with a leading `+` kept if present.
 *
 * `+1 (415) 555-0198` and `+14155550198` are the same number typed by two different people,
 * and storing only the raw strings means the same person imported from two lists never looks
 * like a repeat. The display value is kept as typed; this normalised form exists purely so
 * numbers can be compared.
 */
export function normalisePhone(value: string): string | null {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const hasPlus = trimmed.startsWith("+") || trimmed.startsWith("00");
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length === 0) {
    return null;
  }

  // "00" is the international prefix in much of the world; fold it to "+" so both spellings
  // of the same number compare equal.
  const withoutInternationalPrefix = trimmed.startsWith("00") ? digits.replace(/^00/, "") : digits;

  return hasPlus ? `+${withoutInternationalPrefix}` : withoutInternationalPrefix;
}

/**
 * Whether a phone number is plausible enough to keep.
 *
 * Deliberately loose: numbering plans vary enormously and a too-clever check rejects real
 * numbers, which is worse than storing an odd one. This only catches values with no digits in
 * them at all, like the literal "ABC12345".
 */
export function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");

  return digits.length >= 6 && digits.length <= 15;
}

/**
 * Neutralises spreadsheet formula injection for values that may later be exported to CSV.
 *
 * A cell beginning `=`, `+`, `-` or `@` is executed as a formula by Excel and Google Sheets
 * when the file is opened — so a lead whose company is `@Danger Corp` or whose note is
 * `=HYPERLINK(...)` becomes an attack on whoever opens the export. Prefixing an apostrophe is
 * the standard defusal: spreadsheets read it as "treat the rest as text" and don't display it.
 *
 * Applied on export rather than on save, so the stored value stays exactly what was submitted.
 */
export function neutraliseFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
