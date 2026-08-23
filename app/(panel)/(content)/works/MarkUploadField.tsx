"use client";

import { useRef, useState } from "react";

import MarkPreviewDialog, {
  type MarkPreviewSubject,
} from "@/app/(panel)/(content)/works/MarkPreviewDialog";
import { FieldShell } from "@/components/ui/Field";
import { inspectMarkSvg } from "@/lib/content/inspectMarkSvg";
import {
  MARK_CONTENT_TYPE,
  MARK_FILE_FIELD,
  MARK_MAX_BYTES,
  MARK_REMOVE_FIELD,
} from "@/lib/content/markStorage";

/**
 * The project's mark — the logo the site cuts into interlocking stones.
 *
 * ── ⚠ THE FILE IS CHECKED BEFORE IT IS EVER SUBMITTED, AND THE REASON IS NOT TIDINESS ───────────
 * Whether an SVG works as a mark is decided by whether it contains FILLED geometry, and that
 * question has a wrong answer that looks right: a stroke-only icon does not come out empty, it comes
 * out as a solid blob of its own outlines (see `inspectMarkSvg` for the mechanism). Nothing on the
 * site errors, so without this check the first anyone would know is when the works field showed a
 * disc where a logo used to be — long after the editor who could fix it had moved on.
 *
 * So the check runs here, on selection, using the same loader the site uses, and a file that fails
 * is REMOVED FROM THE INPUT rather than merely flagged. A red line next to a still-loaded file is an
 * invitation to press save anyway.
 *
 * ── The two names this field submits ────────────────────────────────────────────────────────────
 *   `markSvgFile`    the new file, when one was chosen and passed
 *   `markSvgRemove`  a checkbox, so "take the mark away" is expressible at all — an empty file input
 *                    means "leave it alone", and there is no way to spell the difference otherwise
 */

/** Whatever the input currently holds, and what we think of it. */
type Verdict =
  | { kind: "empty" }
  | { kind: "checking" }
  | { kind: "usable"; shapeCount: number; previewUri: string; source: string }
  | { kind: "refused"; reason: string };

export function MarkUploadField({
  currentUrl,
  projectId,
  error,
}: {
  /** The mark already saved on this project, if any. */
  currentUrl?: string | null;
  /**
   * The project being edited, if it exists yet.
   *
   * Only the preview wants it, and only to read a mark back that is already in storage. Absent on
   * the new-project form, where there is nothing stored to read and the file in the input is the
   * whole truth.
   */
  projectId?: string;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [verdict, setVerdict] = useState<Verdict>({ kind: "empty" });
  const [isRemoving, setIsRemoving] = useState(false);

  const handleFileChosen = async () => {
    const input = inputRef.current;
    const file = input?.files?.[0];

    if (!input || !file) {
      setVerdict({ kind: "empty" });
      return;
    }

    setVerdict({ kind: "checking" });

    const source = await file.text();
    const inspection = await inspectMarkSvg(source);

    if (!inspection.ok) {
      // ⚠ Cleared, not just flagged — see the header.
      input.value = "";
      setVerdict({ kind: "refused", reason: inspection.reason ?? "That file cannot be used." });
      return;
    }

    setVerdict({
      kind: "usable",
      shapeCount: inspection.shapeCount,
      // ⚠ A data URI in an `<img>`, never inlined into the page. An `<img>` renders SVG in the
      // browser's secure static mode: no scripts, no external requests, nothing the file can reach.
      // Inlining the same bytes into the DOM would give an uploaded file the panel's own origin.
      previewUri: `data:${MARK_CONTENT_TYPE};utf8,${encodeURIComponent(source)}`,
      // Kept so the 3D preview cuts the bytes in the input rather than fetching the SAVED mark —
      // the whole point of previewing before saving is to see the file that has not been saved.
      source,
    });

    // Choosing a replacement and asking for removal are contradictory; the file wins, silently,
    // because unticking a box the editor has visibly stopped meaning is not worth a message.
    setIsRemoving(false);
  };

  const previewUri = verdict.kind === "usable" ? verdict.previewUri : null;
  const shownMark = previewUri ?? (isRemoving ? null : currentUrl);

  /**
   * What the preview should cut, decided when the button is pressed rather than on every render.
   *
   * The order is the same order the save takes: a chosen file beats a stored one, and asking for
   * removal leaves the project on its initial. Anything else would preview a state that pressing
   * save would not produce.
   */
  const previewSubject = (): MarkPreviewSubject => {
    if (verdict.kind === "usable") return { kind: "source", source: verdict.source };
    if (!isRemoving && projectId && currentUrl) return { kind: "project", projectId };
    return { kind: "initial" };
  };

  /**
   * The title as it stands in the form THIS FIELD IS IN, read at the moment of pressing.
   *
   * It only matters for a project with no mark, where the preview grows an initial — but that is
   * exactly when an editor is most likely to be part-way through typing the name the letter comes
   * from, and showing them the letter they had before the rename would be quietly wrong.
   */
  const projectTitle = (): string => {
    const titleField = inputRef.current?.form?.elements.namedItem("title");
    return titleField instanceof HTMLInputElement ? titleField.value : "";
  };

  return (
    <FieldShell
      label="Mark"
      error={error ?? (verdict.kind === "refused" ? verdict.reason : undefined)}
      hint="The logo the works field grows out of stone. An SVG of filled shapes — outline any strokes before exporting. With no mark, the project grows its own initial instead."
    >
      <div className="flex items-start gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center rounded-sm border border-border bg-[#e2dfd2] p-2.5">
          {shownMark ? (
            /* A data URI and a storage URL, neither of which next/image can optimise without
               being taught a remote host — and this is a 20px admin thumbnail. */
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shownMark} alt="" className="size-full object-contain" />
          ) : (
            <span className="text-[10px] uppercase tracking-[0.12em] text-[#8f4400]/60">
              initial
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            name={MARK_FILE_FIELD}
            accept={`${MARK_CONTENT_TYPE},.svg`}
            onChange={handleFileChosen}
            className="w-full text-xs text-muted file:mr-3 file:rounded-sm file:border file:border-border file:bg-field file:px-3 file:py-1.5 file:text-xs file:text-fg hover:file:border-border-strong"
          />

          <div className="flex items-center gap-2">
            <MarkPreviewDialog
              subject={previewSubject}
              projectTitle={projectTitle}
              triggerLabel="Preview the stone"
              disabled={verdict.kind === "checking"}
            />
            <span className="text-[11px] text-muted/60">
              Cuts it the way the site does, before you save.
            </span>
          </div>

          {verdict.kind === "checking" && (
            <p className="text-[11px] text-muted">Checking that one…</p>
          )}

          {verdict.kind === "usable" && (
            <p className="text-[11px] text-success">
              Ready — {verdict.shapeCount} shape{verdict.shapeCount === 1 ? "" : "s"} to cut.
            </p>
          )}

          {currentUrl && verdict.kind !== "usable" && (
            <label className="flex items-center gap-2 text-[11px] text-muted">
              <input
                type="checkbox"
                name={MARK_REMOVE_FIELD}
                value="yes"
                checked={isRemoving}
                onChange={(event) => setIsRemoving(event.target.checked)}
                className="size-3.5 accent-danger"
              />
              Remove this mark and let the project use its initial
            </label>
          )}

          <p className="text-[11px] text-muted/60">
            SVG, up to {Math.round(MARK_MAX_BYTES / 1024)} KB.
          </p>
        </div>
      </div>
    </FieldShell>
  );
}
