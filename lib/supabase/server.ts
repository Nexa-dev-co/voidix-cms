import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function readSupabaseEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. See .env.example.",
    );
  }

  return { url, anonKey };
}

/**
 * Supabase client bound to the request's cookies. Use inside Server Components, Server
 * Actions and Route Handlers.
 */
export async function createSupabaseServerClient() {
  const { url, anonKey } = readSupabaseEnvironment();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components are not allowed to write cookies. That's fine — the proxy
          // already refreshed the session for this request, so the tokens it would have
          // written here are the same ones the browser is holding.
        }
      },
    },
  });
}
