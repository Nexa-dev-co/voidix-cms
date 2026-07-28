import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * Up/down buttons for an ordered list.
 *
 * Plain forms posting to a server action rather than drag-and-drop: it needs no client
 * bundle, works without JavaScript, and is keyboard-operable for free. These lists are
 * single digits long, so dragging would buy very little.
 */
export function ReorderControls({
  id,
  isFirst,
  isLast,
  moveAction,
  label,
}: {
  id: string;
  isFirst: boolean;
  isLast: boolean;
  moveAction: (formData: FormData) => Promise<void>;
  label: string;
}) {
  return (
    <div className="flex shrink-0 flex-col">
      <form action={moveAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="direction" value="up" />
        <button
          type="submit"
          disabled={isFirst}
          aria-label={`Move ${label} up`}
          className="flex size-7 items-center justify-center rounded-sm text-muted transition-colors duration-150 hover:text-accent disabled:pointer-events-none disabled:opacity-25"
        >
          <ChevronUp className="size-4" aria-hidden />
        </button>
      </form>

      <form action={moveAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="direction" value="down" />
        <button
          type="submit"
          disabled={isLast}
          aria-label={`Move ${label} down`}
          className="flex size-7 items-center justify-center rounded-sm text-muted transition-colors duration-150 hover:text-accent disabled:pointer-events-none disabled:opacity-25"
        >
          <ChevronDown className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}
