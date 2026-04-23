import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logout } from "./login/actions";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, role, email")
    .eq("id", user.id)
    .single();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-brand-border bg-surface">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-medium text-navy">CSD Handshake</h1>
          <form action={logout}>
            <button
              type="submit"
              className="text-sm text-neutral-dark hover:text-navy"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="border border-brand-border rounded-lg p-6 bg-surface">
          <h2 className="font-medium text-navy mb-3">You&apos;re signed in</h2>
          <dl className="text-sm space-y-1">
            <div className="flex gap-2">
              <dt className="text-neutral-dark w-20">Name:</dt>
              <dd className="text-navy">{profile?.full_name ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-neutral-dark w-20">Email:</dt>
              <dd className="text-navy">{profile?.email ?? user.email}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-neutral-dark w-20">Role:</dt>
              <dd>
                <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-role-admin-bg text-role-admin-text">
                  {profile?.role ?? "unknown"}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        <p className="text-sm text-neutral-dark">
          Project list coming in Phase 3. For now, this confirms auth + RLS are working end to end.
        </p>
      </div>
    </main>
  );
}