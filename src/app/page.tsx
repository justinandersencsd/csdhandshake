import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logout } from "./login/actions";
import Link from "next/link";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, role, email, coc_accepted_at, organization")
    .eq("id", user.id)
    .single();

  // Gate partners on COC, students on AUP
  if (profile && !profile.coc_accepted_at) {
    if (profile.role === "partner") redirect("/onboarding/coc");
    if (profile.role === "student") redirect("/onboarding/aup");
  }

  const canInvite =
    profile?.role === "teacher" ||
    profile?.role === "school_admin" ||
    profile?.role === "district_admin";

  const roleStyles: Record<string, string> = {
    student: "bg-role-student-bg text-role-student-text",
    partner: "bg-role-partner-bg text-role-partner-text",
    teacher: "bg-role-teacher-bg text-role-teacher-text",
    school_admin: "bg-role-admin-bg text-role-admin-text",
    district_admin: "bg-role-admin-bg text-role-admin-text",
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-brand-border bg-surface">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-medium text-navy">CSD Handshake</h1>
          <div className="flex items-center gap-4">
            {canInvite && (
              <Link
                href="/admin/invite"
                className="text-sm rounded-md bg-navy text-surface px-3 py-1.5 hover:bg-navy-soft transition"
              >
                + Invite someone
              </Link>
            )}
            <form action={logout}>
              <button
                type="submit"
                className="text-sm text-neutral-dark hover:text-navy"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="border border-brand-border rounded-lg p-6 bg-surface">
          <h2 className="font-medium text-navy mb-3">You&apos;re signed in</h2>
          <dl className="text-sm space-y-1">
            <div className="flex gap-2">
              <dt className="text-neutral-dark w-28">Name:</dt>
              <dd className="text-navy">{profile?.full_name ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-neutral-dark w-28">Email:</dt>
              <dd className="text-navy">{profile?.email ?? user.email}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-neutral-dark w-28">Role:</dt>
              <dd>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                    roleStyles[profile?.role ?? ""] ?? "bg-muted text-foreground"
                  }`}
                >
                  {profile?.role ?? "unknown"}
                </span>
              </dd>
            </div>
            {profile?.organization && (
              <div className="flex gap-2">
                <dt className="text-neutral-dark w-28">Organization:</dt>
                <dd className="text-navy">{profile.organization}</dd>
              </div>
            )}
            {profile?.coc_accepted_at && (
              <div className="flex gap-2">
                <dt className="text-neutral-dark w-28">Agreement:</dt>
                <dd className="text-success-text">
                  ✓ Accepted {new Date(profile.coc_accepted_at).toLocaleDateString()}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <p className="text-sm text-neutral-dark">
          Project list coming in Phase 3.
        </p>
      </div>
    </main>
  );
}
