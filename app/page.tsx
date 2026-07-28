import { redirect } from "next/navigation";

// There is no public surface here — the proxy sends anonymous visitors to /login and
// everyone else lands on the dashboard.
export default function RootPage() {
  redirect("/admin");
}
