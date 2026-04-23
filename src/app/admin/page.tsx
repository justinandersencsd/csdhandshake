import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { AdminNav } from "@/components/admin-nav";
import { SubmitButton } from "@/components/button";
import { relativeTime } from "@/lib/format";
import { adminResendInvitation, adminCancelInvitation } from "./actions";

const ROLE_COLORS: Record<string, string> = {
  student: "bg-role-student/15 text-role-student",
  partner: "bg-role-partner/15 text-role-partner",
  teacher: "bg-role-teacher/15 text-role-teacher",
  school_admin: "bg-role-admin/15 text-role-admin",
  district_admin: "bg-role-admin/15 text-role-admin",
};

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role, full_name, email, school_id, organization, deactivated_at")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");
  if (profile.deactivated_at) {
    await supabase.auth.signOut();
    redirect("/login?error=Your+account+has+been+deactivated.");
  }

  const isAdmin =
    profile.role === "school_admin" || profile.role === "district_admin";
  if (!isAdmin) redirect("/");

  return { user, profile };
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const { profile } = await requireAdmin();
  const isDistrictAdmin = profile.role === "district_admin";

  const admin = createAdminClient();

  const projectsQuery = admin
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  if (!isDistrictAdmin) projectsQuery.eq("school_id", profile.school_id);
  const { count: activeProjects } = await projectsQuery;

  let partnersEngaged = 0;
  {
    const { data } = await admin
      .from("project_members")
      .select(
        "user_id, project:projects!inner(school_id, status), user:users!inner(role)"
      )
      .is("left_at", null);
    const uniquePartners = new Set<string>();
    for (const m of data ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = m.project as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u = m.user as any;
      if (!p || !u) continue;
      if (p.status !== "active") continue;
      if (!isDistrictAdmin && p.school_id !== profile.school_id) continue;
      if (u.role === "partner") uniquePartners.add(m.user_id);
    }
    partnersEngaged = uniquePartners.size;
  }

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const messagesQuery = admin
    .from("messages")
    .select("id, project:projects!inner(school_id)", {
      count: "exact",
      head: false,
    })
    .is("deleted_at", null)
    .gte("created_at", oneWeekAgo);
  if (!isDistrictAdmin) messagesQuery.eq("project.school_id", profile.school_id);
  const { count: messagesThisWeek } = await messagesQuery;

  const flagsQuery = admin
    .from("content_flags")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  const { count: pendingFlagCount } = await flagsQuery;

  const reportsQuery = admin
    .from("message_reports")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  const { count: pendingReportCount } = await reportsQuery;

  const flagsForReview = (pendingFlagCount ?? 0) + (pendingReportCount ?? 0);

  const { data: recentFlags } = await admin
    .from("content_flags")
    .select(
      "id, flag_type, matched_text, was_blocked, created_at, sender:users!sender_id(full_name), project:projects!project_id(id, name, school_id)"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(5);

  const invitesQ = admin
    .from("invitations")
    .select(
      "id, email, full_name, role, organization, created_at, expires_at, project:projects!project_id(id, name, school_id), inviter:users!invited_by(full_name)"
    )
    .is("accepted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  const { data: rawInvites } = await invitesQ;

  const scopedInvites = (rawInvites ?? []).filter((i) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = i.project as any;
    if (isDistrictAdmin) return true;
    return p?.school_id === profile.school_id;
  });

  const now = Date.now();
  const error = typeof sp.error === "string" ? sp.error : null;
  const success = typeof sp.success === "string" ? sp.success : null;

  return (
    <main className="min-h-screen bg-[#F2F5FA] text-foreground">
      <AppHeader profile={profile} canInvite canCreateProject />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 grid gap-6 lg:gap-8 lg:grid-cols-[200px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <AdminNav active="/admin" />
        </aside>

        <div className="space-y-8 min-w-0">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl text-navy">Dashboard</h1>
            <p className="text-sm text-neutral-dark mt-1">
              {isDistrictAdmin ? "District-wide overview" : "Your school"}
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-danger/10 text-danger px-4 py-2 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md bg-success/10 text-success px-4 py-2 text-sm">
              {success}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Active projects" value={activeProjects ?? 0} />
            <MetricCard label="Partners engaged" value={partnersEngaged} />
            <MetricCard
              label="Messages this week"
              value={messagesThisWeek ?? 0}
            />
            <MetricCard
              label="Flags to review"
              value={flagsForReview}
              emphasize={flagsForReview > 0}
              href="/admin/flags"
            />
          </div>

          <section className="bg-surface rounded-xl border border-brand-border p-4 sm:p-6 space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-xl text-navy">
                Pending invitations ({scopedInvites.length})
              </h2>
            </div>
            {scopedInvites.length === 0 ? (
              <p className="text-sm text-neutral-dark italic py-4 text-center">
                No pending invitations. Everyone&apos;s accepted.
              </p>
            ) : (
              <ul className="divide-y divide-brand-border/50">
                {scopedInvites.map((inv) => {
                  const expiresAt = new Date(inv.expires_at).getTime();
                  const isExpired = expiresAt < now;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const p = inv.project as any;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const inviter = inv.inviter as any;
                  return (
                    <li
                      key={inv.id}
                      className="py-3 flex items-start justify-between gap-3 flex-wrap"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap text-sm">
                          <span className="font-medium text-navy">
                            {inv.full_name}
                          </span>
                          <span
                            className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${ROLE_COLORS[inv.role] ?? "bg-neutral-100"}`}
                          >
                            {inv.role.replace("_", " ")}
                          </span>
                          {isExpired && (
                            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-danger/15 text-danger">
                              Expired
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-dark truncate">
                          {inv.email}
                          {inv.organization && ` · ${inv.organization}`}
                        </div>
                        <div className="text-xs text-neutral-dark">
                          {p?.id ? (
                            <>
                              for{" "}
                              <Link
                                href={`/projects/${p.id}`}
                                className="hover:text-navy underline"
                              >
                                {p.name}
                              </Link>
                              {" · "}
                            </>
                          ) : null}
                          sent by {inviter?.full_name ?? "Unknown"} ·{" "}
                          {relativeTime(inv.created_at)}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0 items-center">
                        <form action={adminResendInvitation}>
                          <input
                            type="hidden"
                            name="invitation_id"
                            value={inv.id}
                          />
                          <SubmitButton
                            size="sm"
                            variant="secondary"
                            loadingText="Sending…"
                          >
                            Resend
                          </SubmitButton>
                        </form>
                        <form action={adminCancelInvitation}>
                          <input
                            type="hidden"
                            name="invitation_id"
                            value={inv.id}
                          />
                          <SubmitButton
                            size="sm"
                            variant="ghost"
                            loadingText="Cancelling…"
                          >
                            Cancel
                          </SubmitButton>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="bg-surface rounded-xl border border-brand-border p-4 sm:p-6 space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-xl text-navy">
                Recent content flags
              </h2>
              <Link
                href="/admin/flags"
                className="text-xs text-neutral-dark hover:text-navy"
              >
                View all →
              </Link>
            </div>
            {!recentFlags || recentFlags.length === 0 ? (
              <p className="text-sm text-neutral-dark italic py-4 text-center">
                Nothing to review. 🎉
              </p>
            ) : (
              <ul className="space-y-3">
                {recentFlags.map((f) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const s = f.sender as any;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const p = f.project as any;
                  if (!isDistrictAdmin && p?.school_id !== profile.school_id)
                    return null;
                  return (
                    <li
                      key={f.id}
                      className="flex items-start justify-between gap-3 py-2 border-b border-brand-border/40 last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">
                          <span className="font-medium text-navy">
                            {s?.full_name ?? "Unknown"}
                          </span>
                          <span className="text-neutral-dark"> — </span>
                          <span className="text-neutral-dark">
                            {f.flag_type.replace("_", " ")}
                          </span>
                          {f.was_blocked && (
                            <span className="ml-2 text-[10px] uppercase px-1 py-0.5 rounded bg-danger/15 text-danger">
                              Blocked
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-dark mt-0.5">
                          in{" "}
                          <Link
                            href={`/projects/${p?.id}`}
                            className="hover:text-navy"
                          >
                            {p?.name}
                          </Link>{" "}
                          · {relativeTime(f.created_at)}
                        </div>
                        <div className="text-xs text-neutral-dark/80 font-mono mt-1 truncate">
                          {f.matched_text}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  emphasize,
  href,
}: {
  label: string;
  value: number | string;
  emphasize?: boolean;
  href?: string;
}) {
  const content = (
    <div
      className={`rounded-xl border p-5 bg-surface transition-all duration-150 ${
        emphasize ? "border-warning/40 bg-warning/5" : "border-brand-border"
      } ${href ? "hover:border-navy hover:shadow-sm cursor-pointer card-pressable" : ""}`}
    >
      <div className="text-[11px] uppercase tracking-[0.15em] text-neutral-dark">
        {label}
      </div>
      <div
        className={`font-serif text-3xl mt-2 ${emphasize ? "text-warning" : "text-navy"}`}
      >
        {value}
      </div>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
