import type { ImportPlan } from "@/lib/leads/importPlan";
import type { ImportFieldKey } from "@/lib/leads/spreadsheet";

// These live outside the actions file on purpose. A `"use server"` module turns *every* export
// into a server-function reference, so a plain object exported from one arrives on the client
// as an action stub rather than the value — which is how `IDLE_IMPORT_STATE.headers` ended up
// undefined on first render. Only async functions belong in that file.

export interface ImportPreviewState {
  status: "idle" | "error" | "ready";
  message: string | null;
  filename: string | null;
  headers: string[];
  mapping: Record<ImportFieldKey, number | null> | null;
  plan: ImportPlan | null;
  /** The parsed rows, carried through the confirm step so the file isn't uploaded twice. */
  rows: string[][];
  /** A few real values per column, so a mapping can be confirmed by looking rather than guessing. */
  samples: string[][];
  /** Settings-driven UI hints, so the preview reflects the admin's configured policy. */
  defaultMatchAction: string;
  allowOverwrite: boolean;
}

export const IDLE_IMPORT_STATE: ImportPreviewState = {
  status: "idle",
  message: null,
  filename: null,
  headers: [],
  mapping: null,
  plan: null,
  rows: [],
  samples: [],
  defaultMatchAction: "enrich",
  allowOverwrite: true,
};

export interface ImportResultState {
  status: "idle" | "error" | "done";
  message: string | null;
  created: number;
  enriched: number;
  logged: number;
  skipped: number;
}

export const IDLE_IMPORT_RESULT: ImportResultState = {
  status: "idle",
  message: null,
  created: 0,
  enriched: 0,
  logged: 0,
  skipped: 0,
};
