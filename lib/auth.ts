import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The signed-in admin, or `null`.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

/**
 * The signed-in admin, or a redirect to the login screen.
 *
 * The proxy already blocks anonymous requests, but Server Actions are reachable by direct
 * POST — they do not go through page routing — so every action calls this again rather than
 * trusting that the proxy ran.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
