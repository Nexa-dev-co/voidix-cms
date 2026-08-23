"use client";

import { useEffect, useState, type ComponentProps } from "react";

import { readProjectMarkSource } from "@/app/(panel)/(content)/works/actions";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import type { MarkPreviewScene } from "@/lib/content/markPreviewScene";
import type { MarkPreviewOrigin } from "@/lib/content/markPreviewShapes";

/**
 * The mark, as the works field will actually grow it.
 *
 * ── ⚠ WHY THIS IS NOT A PICTURE OF THE FILE ─────────────────────────────────────────────────────
 * The site never draws the uploaded SVG. It reads the outlines out of it, cuts them into
 * interlocking stones, seeds those off a rock and overgrows the result with geode — so a browser's
 * rendering of the file and what a visitor sees have almost nothing in common. Showing the file
 * bigger would be a preview of the wrong thing, and it would be a CONFIDENT one, which is worse:
 * an editor has no way to tell it apart from a real one.
 *
 * So this runs the site's own builder, vendored verbatim under `lib/content/siteWorksField`. What
 * that costs is a second copy of a renderer in a second repo — see that folder's README and
 * `npm run marks:check-vendor`, which is the thing keeping the copy honest.
 *
 * ── ⚠ EVERYTHING IS LOADED WHEN THE DIALOG OPENS, NOT WHEN THE PAGE DOES ────────────────────────
 * `three`, the post-processing passes, two textures and a typeface, plus a cut that is the heaviest
 * block of work in the section. None of it may land on a works page that is only being read. The
 * scene module is imported dynamically for exactly that reason, and the effect below does nothing
 * at all until `isOpen`.
 */

/** What the preview is being asked to cut. */
export type MarkPreviewSubject =
  /** An SVG in hand — a file the editor has just chosen, before anything is saved. */
  | { kind: "source"; source: string }
  /** A saved project, whose stored mark is read back through a server action. */
  | { kind: "project"; projectId: string }
  /** Nothing to cut, so the project grows its initial — a designed state, not a failure. */
  | { kind: "initial" };

type Stage =
  | { kind: "loading" }
  | { kind: "ready"; origin: MarkPreviewOrigin }
  | { kind: "failed"; reason: string };

/** Written for the editor, not for a log — the two cases they can actually do something about. */
const WEBGL_UNAVAILABLE =
  "This browser could not open a 3D view, so the mark cannot be previewed here. The site itself is unaffected.";
const BUILD_FAILED = "The mark could not be cut. It may not be an SVG the site can read.";

export default function MarkPreviewDialog({
  subject,
  projectTitle,
  triggerLabel = "Preview",
  triggerVariant = "secondary",
  disabled = false,
}: {
  subject: MarkPreviewSubject | (() => MarkPreviewSubject);
  /**
   * The project's title, which is what the initial is taken from.
   *
   * A function on the project form, where the editor may be halfway through renaming it and the
   * letter has to follow what is on screen rather than what was loaded.
   */
  projectTitle: string | (() => string);
  triggerLabel?: string;
  /** The list rows want a quieter button than the form's; nothing else varies between call sites. */
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: "loading" });

  /**
   * ⚠ STATE, NOT A REF, AND THE PREVIEW DOES NOT WORK OTHERWISE.
   *
   * The dialog's content is mounted by Radix in a LATER commit than the one that opens it, so a ref
   * read in this component's effect is still null at that point — and a ref attaching later does not
   * re-run an effect, so the build was never started and the dialog sat on "Cutting the stones…"
   * forever with nothing in the console to say why. Holding the element in state makes its arrival a
   * render, which is the thing the effect can actually wait for.
   */
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  // Read once per opening rather than per render: both may be live reads off the form, and the
  // preview should show the mark as it was when the button was pressed.
  const [openedWith, setOpenedWith] = useState<{
    subject: MarkPreviewSubject;
    title: string;
  } | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setStage({ kind: "loading" });
      setOpenedWith({
        subject: typeof subject === "function" ? subject() : subject,
        title: typeof projectTitle === "function" ? projectTitle() : projectTitle,
      });
    }
    setIsOpen(nextOpen);
  };

  useEffect(() => {
    if (!isOpen || !openedWith || !canvas) return;

    // The scene resolves after the cut, by which point the dialog may already be closed — there is
    // no handle to cancel with until then, so the cleanup disposes whatever the promise gives back.
    let scene: MarkPreviewScene | null = null;
    let isCancelled = false;

    const build = async () => {
      try {
        // ⚠ Imported here and not at the top of the file. A static import would put `three`, four
        // post-processing passes and the whole vendored builder into the works page's bundle, which
        // every editor would download in order to read a list of project titles.
        const [{ createMarkPreviewScene }, { resolvePreviewMark }] = await Promise.all([
          import("@/lib/content/markPreviewScene"),
          import("@/lib/content/markPreviewShapes"),
        ]);

        const source =
          openedWith.subject.kind === "source"
            ? openedWith.subject.source
            : openedWith.subject.kind === "project"
              ? await readProjectMarkSource(openedWith.subject.projectId)
              : null;

        if (isCancelled) return;

        const { mark, origin } = await resolvePreviewMark(source, openedWith.title);

        if (isCancelled) return;

        const built = await createMarkPreviewScene({
          canvas,
          mark,
          onReady: () => setStage({ kind: "ready", origin }),
        });

        if (isCancelled) {
          built.dispose();
          return;
        }

        scene = built;
      } catch (error) {
        if (isCancelled) return;
        console.warn("[marks] preview failed to build:", error);
        setStage({
          kind: "failed",
          // A context that will not be created is the one failure with a different answer for the
          // editor: nothing is wrong with their file, and nothing they change will fix it here.
          reason: canvas.getContext("webgl2") ? BUILD_FAILED : WEBGL_UNAVAILABLE,
        });
      }
    };

    void build();

    return () => {
      isCancelled = true;
      scene?.dispose();
    };
  }, [isOpen, openedWith, canvas]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant={triggerVariant} disabled={disabled}>
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">How the site grows this mark</DialogTitle>
          <DialogDescription className="text-xs">
            The works field cuts the mark into stones rather than drawing the file. This is that
            same builder, at rest — drag to look around it.
          </DialogDescription>
        </DialogHeader>

        {/* The site's own page colour, so the stone is judged against the background it will sit
            on. `--bg` is the same value in both repos. */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-sm border border-border bg-bg">
          <canvas
            ref={setCanvas}
            className={`size-full ${stage.kind === "ready" ? "cursor-grab active:cursor-grabbing" : ""}`}
          />

          {stage.kind === "loading" && (
            <p className="absolute inset-0 flex items-center justify-center text-xs text-muted">
              Cutting the stones…
            </p>
          )}

          {stage.kind === "failed" && (
            <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-xs text-danger">
              {stage.reason}
            </p>
          )}
        </div>

        {stage.kind === "ready" && (
          <p className="text-[11px] text-muted">
            {stage.origin === "svg"
              ? "Cut from the SVG. Only filled shapes are cut — any stroke-only paths in the file are not here, because they are not there on the site either."
              : "No usable SVG, so this is the initial the project grows instead — the same fallback the site uses. It renders in helvetiker there too, not in the brand face."}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
