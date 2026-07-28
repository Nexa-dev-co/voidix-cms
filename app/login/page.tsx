import { LoginForm } from "@/app/login/LoginForm";

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const rawNext = searchParams.next;
  const nextPath = typeof rawNext === "string" ? rawNext : "/admin";

  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="eyebrow mb-2">Control</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">voidix</h1>
          <p className="mt-2 text-sm text-muted">
            Sign in to edit the site&rsquo;s copy.
          </p>
        </div>

        <LoginForm nextPath={nextPath} />
      </div>
    </main>
  );
}
