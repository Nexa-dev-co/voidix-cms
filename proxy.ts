import type { NextRequest } from "next/server";

import { updateSessionAndGuard } from "@/lib/supabase/proxy";

// Next 16 renamed `middleware` to `proxy`. Same file-convention, same matcher, but it always
// runs on the Node runtime now.
export async function proxy(request: NextRequest) {
  return updateSessionAndGuard(request);
}

export const config = {
  // Everything except Next's own assets and static files. The guard itself decides which
  // paths are public, so keep this matcher broad — narrowing it here is how routes
  // accidentally end up unauthenticated.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
