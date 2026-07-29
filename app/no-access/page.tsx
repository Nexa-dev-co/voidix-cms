import { signOutAction } from "@/app/login/actions";

/**
 * Shown to someone who authenticated with Supabase but has no active `team_members` row.
 *
 * This is the expected landing place for a brand-new Auth account: creating a login does not
 * grant access on its own, an admin has to add them to the team first.
 */
export default function NoAccessPage() {
  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <p className="eyebrow mb-2">Control</p>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">No access</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Your sign-in worked, but this account isn&rsquo;t on the team yet. An admin needs to add
          you under Team before you can see anything.
        </p>

        <form action={signOutAction} className="mt-6">
          <button
            type="submit"
            className="text-xs text-muted transition-colors duration-150 hover:text-accent"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
