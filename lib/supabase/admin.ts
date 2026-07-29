import "server-only";

import { randomBytes } from "node:crypto";

// The service role key bypasses RLS and can create, modify and delete any user in the
// project. `server-only` at the top of this file makes importing it from a Client Component a
// build error rather than a silent leak of that key into the browser bundle.
//
// Everything here must stay behind `requireAdmin()` at the call site.

const TEMPORARY_PASSWORD_BYTES = 12;

function readAdminEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) must be set to manage logins from the panel.",
    );
  }

  return { url, serviceRoleKey };
}

export function isAuthAdminConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * A password that is strong enough to be the only thing protecting the account until it's
 * changed, and still typeable if it has to be read out loud.
 */
export function generateTemporaryPassword(): string {
  return randomBytes(TEMPORARY_PASSWORD_BYTES).toString("base64url");
}

async function callAdminApi(path: string, init: RequestInit) {
  const { url, serviceRoleKey } = readAdminEnvironment();

  const response = await fetch(`${url}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const body = (await response.json().catch(() => null)) as
    | { id?: string; msg?: string; message?: string; error_description?: string; users?: unknown[] }
    | null;

  return { ok: response.ok, status: response.status, body };
}

export interface CreatedAuthUser {
  authUserId: string;
  /** Null when the account already existed and was linked rather than created. */
  temporaryPassword: string | null;
  alreadyExisted: boolean;
}

/**
 * Creates a Supabase Auth login, or links the one that already exists.
 *
 * `email_confirm: true` skips the confirmation email — the panel is invite-only and the admin
 * creating the account is the verification. Without it the person could not sign in until
 * they clicked a link that Supabase's default SMTP frequently fails to deliver.
 *
 * An email that already has an account is linked rather than treated as an error: that is the
 * normal case when someone was set up in the Supabase dashboard first.
 */
export async function createOrLinkAuthUser(email: string): Promise<CreatedAuthUser> {
  const temporaryPassword = generateTemporaryPassword();

  const created = await callAdminApi("/users", {
    method: "POST",
    body: JSON.stringify({ email, password: temporaryPassword, email_confirm: true }),
  });

  if (created.ok && created.body?.id) {
    return { authUserId: created.body.id, temporaryPassword, alreadyExisted: false };
  }

  const existingId = await findAuthUserIdByEmail(email);

  if (existingId) {
    return { authUserId: existingId, temporaryPassword: null, alreadyExisted: true };
  }

  const reason =
    created.body?.msg ?? created.body?.message ?? created.body?.error_description ?? "unknown error";

  throw new Error(`Supabase couldn't create that login: ${reason}`);
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const result = await callAdminApi(`/users?per_page=200`, { method: "GET" });

  if (!result.ok || !Array.isArray(result.body?.users)) {
    return null;
  }

  const match = (result.body.users as { id: string; email?: string }[]).find(
    (user) => user.email?.toLowerCase() === email,
  );

  return match?.id ?? null;
}

/** Issues a fresh temporary password for an existing login. */
export async function resetAuthUserPassword(authUserId: string): Promise<string> {
  const temporaryPassword = generateTemporaryPassword();

  const result = await callAdminApi(`/users/${authUserId}`, {
    method: "PUT",
    body: JSON.stringify({ password: temporaryPassword }),
  });

  if (!result.ok) {
    const reason = result.body?.msg ?? result.body?.message ?? "unknown error";
    throw new Error(`Couldn't reset that password: ${reason}`);
  }

  return temporaryPassword;
}

/**
 * Deletes the login itself.
 *
 * Used when removing someone from the team outright. Deactivating is the softer option and
 * leaves the account intact — see `setMemberActiveAction`, which is what you want if their
 * name should keep rendering on contacts they used to own.
 */
export async function deleteAuthUser(authUserId: string): Promise<void> {
  const result = await callAdminApi(`/users/${authUserId}`, { method: "DELETE" });

  if (!result.ok && result.status !== 404) {
    const reason = result.body?.msg ?? result.body?.message ?? "unknown error";
    throw new Error(`Couldn't delete that login: ${reason}`);
  }
}
