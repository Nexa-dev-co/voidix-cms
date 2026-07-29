"use client";

import { useState, type ReactNode } from "react";

import { findMarkdownWarnings } from "@/lib/text/plainText";
import { isSafeLinkUrl } from "@/lib/validation/contentSchemas";

const CONTROL_CLASSES =
  "w-full rounded-sm border border-border bg-field px-3 py-2 text-sm text-fg placeholder:text-muted transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none";

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  /** Live "84 / 120" counter. Turns amber near the cap and red past it. */
  counter?: { current: number; max: number };
  warnings?: string[];
  children: ReactNode;
}

function FieldShell({ label, hint, error, counter, warnings, children }: FieldShellProps) {
  const isOverLimit = counter ? counter.current > counter.max : false;
  const isNearLimit = counter ? !isOverLimit && counter.current > counter.max * 0.9 : false;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <label className="text-xs uppercase tracking-[0.14em] text-muted">{label}</label>
        {counter && (
          <span
            className={`text-[11px] tabular-nums ${
              isOverLimit ? "text-danger" : isNearLimit ? "text-warning" : "text-muted"
            }`}
          >
            {counter.current} / {counter.max}
          </span>
        )}
      </div>

      {children}

      {hint && !error && <p className="text-[11px] leading-relaxed text-muted">{hint}</p>}

      {warnings?.map((warning) => (
        <p key={warning} className="text-[11px] leading-relaxed text-warning">
          {warning}
        </p>
      ))}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

/**
 * A single-line text field.
 *
 * `maxLength` is intentionally NOT set on the input: a hard browser cap silently truncates a
 * paste with no explanation. Showing the overflow in red and letting the server reject it
 * tells the editor what happened and gives them their words back to edit down.
 */
export function TextField({
  label,
  name,
  defaultValue = "",
  max,
  hint,
  error,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  max: number;
  hint?: string;
  error?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <FieldShell label={label} hint={hint} error={error} counter={{ current: value.length, max }}>
      <input
        type="text"
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        className={CONTROL_CLASSES}
      />
    </FieldShell>
  );
}

/** A multi-line field that also flags markdown the site would render as literal characters. */
export function TextAreaField({
  label,
  name,
  defaultValue = "",
  max,
  rows = 4,
  hint,
  error,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  max: number;
  rows?: number;
  hint?: string;
  error?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      counter={{ current: value.length, max }}
      warnings={findMarkdownWarnings(value)}
    >
      <textarea
        name={name}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        className={`${CONTROL_CLASSES} resize-y leading-relaxed`}
      />
    </FieldShell>
  );
}

/**
 * The chip lists (service capabilities, project tags). One comma-or-newline separated input
 * with a live preview of the chips as the site will render them, because the thing an editor
 * actually needs to see is how many there are and how long each one runs.
 */
export function ChipListField({
  label,
  name,
  defaultValue = [],
  maxLabel,
  maxCount,
  hint,
  error,
}: {
  label: string;
  name: string;
  defaultValue?: string[];
  maxLabel: number;
  maxCount: number;
  hint?: string;
  error?: string;
}) {
  const [value, setValue] = useState(defaultValue.join(", "));

  const chips = value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      counter={{ current: chips.length, max: maxCount }}
    >
      <input
        type="text"
        name={name}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Next.js, WebGL / GLSL, Realtime"
        className={CONTROL_CLASSES}
      />

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {chips.map((chip, index) => (
            <span
              key={`${chip}-${index}`}
              className={`rounded-sm border px-2 py-0.5 text-[11px] ${
                chip.length > maxLabel
                  ? "border-danger/40 text-danger"
                  : "border-border-strong text-muted"
              }`}
            >
              {chip}
            </span>
          ))}
        </div>
      )}
    </FieldShell>
  );
}

/**
 * The FAQ answer: a textarea split into paragraphs on blank lines. Each paragraph becomes
 * its own `<p>` in the hologram, so the preview counts them back to the editor.
 */
export function ParagraphsField({
  label,
  name,
  defaultValue = "",
  maxParagraph,
  maxCount,
  hint,
  error,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  maxParagraph: number;
  maxCount: number;
  hint?: string;
  error?: string;
}) {
  const [value, setValue] = useState(defaultValue);

  const paragraphs = value
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  const longestParagraph = paragraphs.reduce(
    (longest, paragraph) => Math.max(longest, paragraph.length),
    0,
  );

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      counter={{ current: paragraphs.length, max: maxCount }}
      warnings={findMarkdownWarnings(value)}
    >
      <textarea
        name={name}
        rows={10}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={"First paragraph.\n\nSecond paragraph — leave a blank line between them."}
        className={`${CONTROL_CLASSES} resize-y leading-relaxed`}
      />
      <p className="text-[11px] text-muted">
        {paragraphs.length} paragraph{paragraphs.length === 1 ? "" : "s"}
        {longestParagraph > 0 && (
          <>
            {" · longest "}
            <span className={longestParagraph > maxParagraph ? "text-danger" : undefined}>
              {longestParagraph} / {maxParagraph}
            </span>
          </>
        )}
      </p>
    </FieldShell>
  );
}

/**
 * Footer link lists, typed one per line as `Label | https://url`.
 *
 * A line-based textarea rather than a repeatable row widget: it pastes well, reorders by
 * moving a line, and needs no add/remove button choreography. The preview underneath parses
 * each line back out so the split is never a guess, and flags any URL the server will reject.
 */
export function LinkListField({
  label,
  name,
  defaultValue = [],
  maxCount,
  hint,
  error,
}: {
  label: string;
  name: string;
  defaultValue?: { label: string; url: string }[];
  maxCount: number;
  hint?: string;
  error?: string;
}) {
  const [value, setValue] = useState(
    defaultValue.map((link) => `${link.label} | ${link.url}`).join("\n"),
  );

  const parsedLinks = value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const separatorIndex = line.indexOf("|");
      if (separatorIndex === -1) {
        return { label: line, url: "" };
      }
      return {
        label: line.slice(0, separatorIndex).trim(),
        url: line.slice(separatorIndex + 1).trim(),
      };
    });

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      counter={{ current: parsedLinks.length, max: maxCount }}
    >
      <textarea
        name={name}
        rows={5}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={"X | https://x.com/voidix\nGitHub | https://github.com/voidix"}
        className={`${CONTROL_CLASSES} resize-y font-mono text-xs leading-relaxed`}
      />

      {parsedLinks.length > 0 && (
        <ul className="flex flex-col gap-1 pt-1">
          {parsedLinks.map((link, index) => {
            const isValid = isSafeLinkUrl(link.url);

            return (
              <li key={index} className="flex items-baseline gap-2 text-[11px]">
                <span className="shrink-0 text-fg">{link.label || "(no label)"}</span>
                <span aria-hidden className="text-muted/40">
                  →
                </span>
                <span className={`truncate ${isValid ? "text-muted" : "text-danger"}`}>
                  {link.url || "(no URL)"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </FieldShell>
  );
}

/** Banner shown at the top of a form after a save attempt. */
export function FormMessage({ status, message }: { status: string; message: string | null }) {
  if (!message) {
    return null;
  }

  const isError = status === "error";

  return (
    <div
      role="status"
      className={`rounded-sm border px-3 py-2 text-sm ${
        isError ? "border-danger/40 bg-danger/5 text-danger" : "border-success/40 bg-success/5 text-success"
      }`}
    >
      {message}
    </div>
  );
}
