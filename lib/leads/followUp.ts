/**
 * Shared rules for scheduling and recording a follow-up.
 *
 * A plain module rather than part of the Server Action file, because both the action and the
 * wizard component need these — and a `"use server"` file may only export async functions, so a
 * constant exported from one arrives on the client as a stub instead of a value.
 */

/** How far the quick "No answer" path pushes the next follow-up. */
export const QUICK_FOLLOW_UP_DAYS = 3;

/** What the quick path looks for in the outcome vocabulary before falling back. */
const QUICK_OUTCOME_PATTERN = /no answer/i;

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);

  return result;
}

/**
 * A `YYYY-MM-DD` input value turned into local start-of-day.
 *
 * Local rather than UTC on purpose: "overdue" is decided against the server's start-of-today, so
 * storing a follow-up at UTC midnight would make a date west of Greenwich read as overdue for
 * part of the day it was actually due.
 */
export function parseFollowUpDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** The inverse, for pre-filling a `<input type="date">`. */
export function toFollowUpInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export interface AttemptVocabularyEntry {
  id: string;
  label: string;
}

export interface QuickFollowUpChoice {
  channel: string;
  outcome: string;
  days: number;
}

/**
 * What the one-click "no answer" button records.
 *
 * Resolved from the live vocabulary rather than hardcoded, because an admin may have renamed or
 * retired "No answer" — and an attempt stores the label as text, so writing a word that is no
 * longer in the list would put a value in the history that the form itself can't produce.
 *
 * Both the button and the action call this, so what the label promises and what gets written
 * cannot drift.
 */
export function resolveQuickFollowUp(
  channels: AttemptVocabularyEntry[],
  outcomes: AttemptVocabularyEntry[],
): QuickFollowUpChoice | null {
  const channel = channels[0];

  if (!channel || outcomes.length === 0) {
    return null;
  }

  const outcome = outcomes.find((entry) => QUICK_OUTCOME_PATTERN.test(entry.label)) ?? outcomes[0];

  return { channel: channel.label, outcome: outcome.label, days: QUICK_FOLLOW_UP_DAYS };
}
