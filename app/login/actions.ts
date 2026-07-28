"use server";

import { redirect } from "next/navigation";

import { formError, type FormState } from "@/lib/forms/formState";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Only allow relative paths, so `?next=` can't be used to bounce someone off-site. */
function safeRedirectTarget(rawTarget: FormDataEntryValue | null): string {
  const target = typeof rawTarget === "string" ? rawTarget : "";

  if (target.startsWith("/") && !target.startsWith("//")) {
    return target;
  }

  return "/admin";
}

export async function signInAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return formError("Enter your email and password.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase distinguishes "wrong password" from "no such user"; the panel deliberately
    // does not, so a stranger can't use the login form to enumerate who has an account.
    return formError("Those credentials weren't accepted.");
  }

  // Outside the error branch on purpose — `redirect` throws a control-flow signal, so it
  // must not sit inside anything that catches.
  redirect(safeRedirectTarget(formData.get("next")));
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
