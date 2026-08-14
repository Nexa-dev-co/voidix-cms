"use client";

import { useState, type ReactNode } from "react";

import { findMarkdownWarnings } from "@/lib/text/plainText";
import { isExternalLinkUrl, isSafeLinkUrl } from "@/lib/validation/contentSchemas";

const CONTROL_CLASSES =
  "w-full rounded-sm border border-border bg-field px-3 py-2 text-sm text-fg placeholder:text-muted transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none";

interface FieldShellProps {
  label: string;
  /**
   * The shape this value takes on the site — "chips", "bullets", "paragraphs".
   *
   * The label says what the site calls it; this says what the site does with it. They are
   * different questions and an editor needs both: `bonus` and `needs` are both lists of short
   * strings, and only one of them renders as chips. A line that reads fine as a bullet becomes
   * an unreadably wide chip, and nothing in the stored value distinguishes them.
   */
  rendersAs?: string;
  hint?: string;
  error?: string;
  /** Live "84 / 120" counter. Turns amber near the cap and red past it. */
  counter?: { current: number; max: number };
  warnings?: string[];
  children: ReactNode;
}

function FieldShell({
  label,
  rendersAs,
  hint,
  error,
  counter,
  warnings,
  children,
}: FieldShellProps) {
  const isOverLimit = counter ? counter.current > counter.max : false;
  const isNearLimit = counter ? !isOverLimit && counter.current > counter.max * 0.9 : false;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <label className="text-xs uppercase tracking-[0.14em] text-muted">{label}</label>

        <div className="flex shrink-0 items-baseline gap-2.5">
          {rendersAs && (
            <span className="text-[10px] lowercase tracking-[0.1em] text-muted/70">
              {rendersAs}
            </span>
          )}
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
  rendersAs,
  name,
  defaultValue = "",
  max,
  hint,
  error,
  placeholder,
}: {
  label: string;
  rendersAs?: string;
  name: string;
  defaultValue?: string;
  max: number;
  hint?: string;
  error?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <FieldShell
      label={label}
      rendersAs={rendersAs}
      hint={hint}
      error={error}
      counter={{ current: value.length, max }}
    >
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
  rendersAs,
  name,
  defaultValue = "",
  max,
  rows = 4,
  hint,
  error,
  placeholder,
}: {
  label: string;
  rendersAs?: string;
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
      rendersAs={rendersAs}
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
 * A choice from a fixed list.
 *
 * No counter: there is nothing to count when the value is one of a handful of known options, and
 * a counter over a select reads as an input that can overflow when it cannot.
 */
export function SelectField({
  label,
  rendersAs,
  name,
  defaultValue,
  options,
  hint,
  error,
}: {
  label: string;
  rendersAs?: string;
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  hint?: string;
  error?: string;
}) {
  return (
    <FieldShell label={label} rendersAs={rendersAs} hint={hint} error={error}>
      <select name={name} defaultValue={defaultValue} className={CONTROL_CLASSES}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
  rendersAs,
  name,
  defaultValue = [],
  maxLabel,
  maxCount,
  hint,
  error,
}: {
  label: string;
  rendersAs?: string;
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
      rendersAs={rendersAs}
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
  rendersAs,
  name,
  defaultValue = "",
  maxParagraph,
  maxCount,
  hint,
  error,
}: {
  label: string;
  rendersAs?: string;
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
      rendersAs={rendersAs}
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

const GROUP_TITLE_LINE = /^\[(.*)\]$/;

/**
 * The footer's titled link columns, as one block of text.
 *
 * A line-based textarea rather than a repeatable widget nested two levels deep: it pastes well,
 * moves a link between groups by moving a line, and needs no add/remove choreography for either
 * level. `[Group]` marks a heading; every line under it is `Label | href`.
 *
 * The preview is grouped the way the footer is, so the columns an editor is about to ship are
 * visible as columns. It flags anything the server will reject and marks which destinations
 * leave the site, because that flag is derived from the href rather than typed — showing it is
 * the only way an editor can tell what the site will do with a link.
 */
export function LinkGroupsField({
  label,
  rendersAs,
  name,
  defaultValue = [],
  maxGroups,
  maxLinksPerGroup,
  hint,
  error,
}: {
  label: string;
  rendersAs?: string;
  name: string;
  defaultValue?: { title: string; links: { label: string; href: string }[] }[];
  maxGroups: number;
  maxLinksPerGroup: number;
  hint?: string;
  error?: string;
}) {
  const [value, setValue] = useState(
    defaultValue
      .map((group) =>
        [`[${group.title}]`, ...group.links.map((link) => `${link.label} | ${link.href}`)].join(
          "\n",
        ),
      )
      .join("\n\n"),
  );

  const groups: { title: string; links: { label: string; href: string }[] }[] = [];
  const orphanLinks: string[] = [];

  for (const rawLine of value.split("\n")) {
    const line = rawLine.trim();

    if (line.length === 0) {
      continue;
    }

    const titleMatch = GROUP_TITLE_LINE.exec(line);

    if (titleMatch) {
      groups.push({ title: titleMatch[1].trim(), links: [] });
      continue;
    }

    const currentGroup = groups[groups.length - 1];

    if (!currentGroup) {
      orphanLinks.push(line);
      continue;
    }

    const separatorIndex = line.indexOf("|");
    currentGroup.links.push(
      separatorIndex === -1
        ? { label: line, href: "" }
        : {
            label: line.slice(0, separatorIndex).trim(),
            href: line.slice(separatorIndex + 1).trim(),
          },
    );
  }

  return (
    <FieldShell
      label={label}
      rendersAs={rendersAs}
      hint={hint}
      error={error}
      counter={{ current: groups.length, max: maxGroups }}
    >
      <textarea
        name={name}
        rows={12}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={
          "[Studio]\nAbout | /about\nCareers | /careers\n\n[Elsewhere]\nX | https://x.com/voidixstudio"
        }
        className={`${CONTROL_CLASSES} resize-y font-mono text-xs leading-relaxed`}
      />

      {orphanLinks.length > 0 && (
        <p className="text-[11px] leading-relaxed text-danger">
          {orphanLinks.length} link{orphanLinks.length === 1 ? "" : "s"} above the first group
          heading. Every link needs a heading like <code>[Studio]</code> over it.
        </p>
      )}

      {groups.length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-3 pt-1">
          {groups.map((group, groupIndex) => (
            <div key={groupIndex} className="min-w-[9rem] flex-1">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted/50">
                {group.title || <span className="text-danger">(no title)</span>}
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {group.links.map((link, linkIndex) => (
                  <li key={linkIndex} className="flex items-baseline gap-1.5 text-[11px]">
                    <span className="shrink-0 text-fg">{link.label || "(no label)"}</span>
                    {isSafeLinkUrl(link.href) && isExternalLinkUrl(link.href) && (
                      <span aria-label="opens in a new tab" className="shrink-0 text-muted/40">
                        ↗
                      </span>
                    )}
                    <span
                      className={`truncate ${isSafeLinkUrl(link.href) ? "text-muted" : "text-danger"}`}
                    >
                      {link.href || "(no destination)"}
                    </span>
                  </li>
                ))}
                {group.links.length === 0 && (
                  <li className="text-[11px] text-danger">(no links)</li>
                )}
                {group.links.length > maxLinksPerGroup && (
                  <li className="text-[11px] text-danger">
                    {group.links.length} links — {maxLinksPerGroup} is the most in one column.
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </FieldShell>
  );
}

/**
 * An ordered list of sentences, one per line.
 *
 * Not `ChipListField`, which also splits on commas — every entry here is a full sentence and
 * most of them contain one.
 *
 * ⚠ The input shape and the RENDERED shape are two different decisions, and a role's `bonus`
 * is why `previewAs` exists. It renders on the site as chips, but one of the site's own
 * examples is "Native graphics (Metal, Vulkan)" — parse that on commas and it becomes two
 * broken chips. So the typing stays newline-separated and comma-safe while the preview shows
 * what the visitor will actually see. Never switch a field to `ChipListField` merely because
 * the site draws it as chips.
 */
export function LineListField({
  label,
  rendersAs,
  name,
  defaultValue = [],
  maxEntry,
  maxCount,
  hint,
  error,
  placeholder,
  previewAs = "numbered",
}: {
  label: string;
  rendersAs?: string;
  name: string;
  defaultValue?: string[];
  maxEntry: number;
  maxCount: number;
  hint?: string;
  error?: string;
  placeholder?: string;
  previewAs?: "numbered" | "chips";
}) {
  const [value, setValue] = useState(defaultValue.join("\n"));

  const entries = value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return (
    <FieldShell
      label={label}
      rendersAs={rendersAs}
      hint={hint}
      error={error}
      counter={{ current: entries.length, max: maxCount }}
      warnings={findMarkdownWarnings(value)}
    >
      <textarea
        name={name}
        rows={4}
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        className={`${CONTROL_CLASSES} resize-y leading-relaxed`}
      />

      {entries.length > 0 &&
        (previewAs === "chips" ? (
          <ul className="flex flex-wrap gap-1.5 pt-1">
            {entries.map((entry, index) => (
              <li
                key={index}
                className={`rounded-sm border px-2 py-0.5 text-[11px] ${
                  entry.length > maxEntry
                    ? "border-danger/40 text-danger"
                    : "border-border-strong text-muted"
                }`}
              >
                {entry}
              </li>
            ))}
          </ul>
        ) : (
          <ol className="flex flex-col gap-1 pt-1">
            {entries.map((entry, index) => (
              <li key={index} className="flex items-baseline gap-2 text-[11px]">
                <span aria-hidden className="shrink-0 tabular-nums text-muted/50">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className={entry.length > maxEntry ? "text-danger" : "text-muted"}>
                  {entry}
                </span>
              </li>
            ))}
          </ol>
        ))}
    </FieldShell>
  );
}

/**
 * An ordered list whose entries have several fields, typed one per line and separated by `|`.
 *
 * The same input shape as `LinkGroupsField` and chosen for the same reasons — it pastes, it
 * reorders by moving a line, and it needs no add/remove choreography for a list four entries
 * long. The preview splits each line back into its named parts, so an editor can see at a
 * glance which segment landed where and that nothing is missing.
 */
export function DelimitedListField({
  label,
  rendersAs,
  name,
  parts,
  defaultValue = [],
  maxCount,
  hint,
  error,
  placeholder,
}: {
  label: string;
  rendersAs?: string;
  name: string;
  /** In order, and each one required — the server rejects a line missing any of them. */
  parts: readonly { key: string; label: string; max: number }[];
  defaultValue?: Record<string, string>[];
  maxCount: number;
  hint?: string;
  error?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(
    defaultValue.map((entry) => parts.map((part) => entry[part.key] ?? "").join(" | ")).join("\n"),
  );

  const rows = value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const segments = line.split("|");

      return parts.map((part, index) => ({
        part,
        text: (segments[index] ?? "").trim(),
      }));
    });

  return (
    <FieldShell
      label={label}
      rendersAs={rendersAs}
      hint={hint}
      error={error}
      counter={{ current: rows.length, max: maxCount }}
      warnings={findMarkdownWarnings(value)}
    >
      <textarea
        name={name}
        rows={5}
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        className={`${CONTROL_CLASSES} resize-y font-mono text-xs leading-relaxed`}
      />

      {rows.length > 0 && (
        <ul className="flex flex-col gap-2 pt-1">
          {rows.map((row, index) => (
            <li key={index} className="flex flex-col gap-0.5 border-l border-border pl-2.5">
              {row.map(({ part, text }) => (
                <span key={part.key} className="flex items-baseline gap-2 text-[11px]">
                  <span className="w-14 shrink-0 uppercase tracking-[0.12em] text-muted/50">
                    {part.label}
                  </span>
                  <span
                    className={
                      text.length === 0 || text.length > part.max ? "text-danger" : "text-muted"
                    }
                  >
                    {text.length === 0 ? "(missing)" : text}
                  </span>
                </span>
              ))}
            </li>
          ))}
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
