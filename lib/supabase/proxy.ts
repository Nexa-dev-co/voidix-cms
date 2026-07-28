import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { readSupabaseEnvironment } from "@/lib/supabase/server";

const LOGIN_PATH = "/login";
const PUBLIC_PATHS = new Set<string>([LOGIN_PATH]);

/**
 * Refreshes the Supabase session on every request and bounces anonymous visitors to the
 * login screen.
 *
 * Two rules this must not break:
 *
 *  1. `getUser()` has to be called — it revalidates the token against Supabase, unlike
 *     `getSession()`, which just decodes whatever cookie the browser sent.
 *  2. The response object created here is the one that must be returned. Supabase writes
 *     refreshed auth cookies onto it, so building a fresh `NextResponse` later in the
 *     function would silently drop the rotated tokens and log the user out mid-session.
 */
export async function updateSessionAndGuard(request: NextRequest) {
  const { url, anonKey } = readSupabaseEnvironment();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.has(pathname);

  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = LOGIN_PATH;
    // Remember where they were headed so login can send them back there.
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isPublicPath) {
    const adminUrl = request.nextUrl.clone();
    adminUrl.pathname = "/admin";
    adminUrl.search = "";
    return NextResponse.redirect(adminUrl);
  }

  return response;
}
