import "server-only";

import { createClient } from "@supabase/supabase-js";

import {
  buildMarkStoragePath,
  describeUnsafeSvg,
  markPublicUrl,
  MARK_BUCKET,
  MARK_CONTENT_TYPE,
  MARK_MAX_BYTES,
} from "@/lib/content/markStorage";

/**
 * Putting a project's mark into storage, and taking the old one back out.
 *
 * ── ⚠ WHY THE BYTES COME THROUGH THIS APP AFTER ALL ─────────────────────────────────────────────
 * The careers intake makes a point of never receiving a file — a CV goes to UploadThing from the
 * site and we only ever hold a URL. This does the opposite, deliberately, and the difference is who
 * is uploading. That path is open to the public, where every byte accepted is a liability. This one
 * is behind `requireAdmin()`, and routing it through the server buys the thing that matters most:
 * **the file is validated before it is stored**, not after.
 *
 * The alternative was a browser-direct upload with a Storage RLS policy. That would need the policy
 * to re-express "an admin of this panel" in SQL, which is a second copy of an authorisation rule
 * that already exists in code — and storage policies are the easiest thing in Supabase to get
 * subtly wrong. One writer, one gate, one place to read it.
 *
 * ⚠ The service-role key BYPASSES RLS ON EVERY TABLE. Nothing here may be called from anywhere that
 * has not already passed `requireAdmin()`.
 */

/** What a mark change resolved to. Applied by the caller so the DB write stays one transaction. */
export type MarkChange =
  /** No file chosen and no removal asked for — leave whatever is on the row. */
  | { kind: "unchanged" }
  /** A new file is in storage and these are its coordinates. */
  | { kind: "stored"; url: string; storagePath: string }
  /** The editor asked for the mark to go; the project falls back to its initial. */
  | { kind: "cleared" }
  /** Nothing was stored. The message is for the editor, keyed to the file field. */
  | { kind: "refused"; message: string };

function readStorageEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return { url, serviceRoleKey };
}

/**
 * Constructed per call rather than at module scope: the key is read at construction, and a
 * module-level client would capture whatever the environment held when this file was first imported.
 */
function createStorageClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Reads the mark half of a project form and, if there is a new file, stores it.
 *
 * ⚠ Storing happens BEFORE the row is written, on purpose. The reverse order can leave a project
 * claiming a mark that never made it into the bucket, and a row pointing at nothing renders as a
 * broken mark on the site rather than as an error anyone sees here.
 */
export async function resolveMarkChange(
  formData: FormData,
  options: { projectSlug: string; fileField: string; removeField: string },
): Promise<MarkChange> {
  const wantsRemoval = Boolean(formData.get(options.removeField));
  const submitted = formData.get(options.fileField);
  const file = submitted instanceof File && submitted.size > 0 ? submitted : null;

  if (!file) {
    return wantsRemoval ? { kind: "cleared" } : { kind: "unchanged" };
  }

  if (file.size > MARK_MAX_BYTES) {
    return {
      kind: "refused",
      message: `That file is over the ${Math.round(MARK_MAX_BYTES / 1024)} KB limit.`,
    };
  }

  // The browser sends a type it inferred from the extension, so this is a cheap sanity check rather
  // than proof — `describeUnsafeSvg` below is the one that reads the actual bytes.
  if (file.type && file.type !== MARK_CONTENT_TYPE) {
    return { kind: "refused", message: "That is not an SVG file." };
  }

  const source = await file.text();
  const unsafe = describeUnsafeSvg(source);

  if (unsafe) {
    return { kind: "refused", message: unsafe };
  }

  const environment = readStorageEnvironment();

  if (!environment) {
    return {
      kind: "refused",
      message:
        "Marks cannot be stored — NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.",
    };
  }

  const storagePath = buildMarkStoragePath(options.projectSlug);
  const storage = createStorageClient(environment.url, environment.serviceRoleKey);

  const { error } = await storage.storage.from(MARK_BUCKET).upload(storagePath, source, {
    contentType: MARK_CONTENT_TYPE,
    // Every upload gets a fresh path, so there is never anything here to overwrite. `false` turns a
    // path collision into an error instead of silently replacing a different project's mark.
    upsert: false,
  });

  if (error) {
    console.warn(`[marks] upload failed: ${error.message}`);
    return { kind: "refused", message: "That file could not be stored. Try again." };
  }

  return { kind: "stored", url: markPublicUrl(storagePath), storagePath };
}

/**
 * Removes a stored mark. Best effort, and never throws.
 *
 * ⚠ Called AFTER the row has been written, which is the other half of the ordering note above: a
 * delete that runs first and is followed by a failed write destroys the file the row still points
 * at. An orphaned object costs a kilobyte; a row pointing at a deleted object costs the mark.
 */
export async function deleteStoredMark(storagePath: string | null | undefined): Promise<void> {
  if (!storagePath) return;

  const environment = readStorageEnvironment();
  if (!environment) return;

  try {
    const storage = createStorageClient(environment.url, environment.serviceRoleKey);
    const { error } = await storage.storage.from(MARK_BUCKET).remove([storagePath]);

    if (error) {
      console.warn(`[marks] could not delete ${storagePath}: ${error.message}`);
    }
  } catch (error) {
    console.warn(
      `[marks] deleting ${storagePath} threw: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }
}
