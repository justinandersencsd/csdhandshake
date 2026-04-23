import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { AdminNav } from "@/components/admin-nav";
import { relativeTime } from "@/lib/format";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role, full_name, email, school_id, organization")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  const isAdmin =
    profile.role === "school_admin" || profile.role === "district_admin";
  if (!isAdmin) redirect("/");

  return { user, profile };
}

export default async function AdminPage() {
  const { profile } = await requireAdmin();
  const isDistrictAdmin = profile.role === "district_admin";

  const admin = createAdminClient();

  const schoolFilter = isDistrictAdmin
    ? undefined
    : { school_id: profile.school_id };

  // Metric 1: active projects
  const projectsQuery = admin
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  if (!isDistrictAdmin) projectsQuery.eq("school_id", profile.school_id);
  const { count: activeProjects } = await projectsQuery;

  // Metric 2: partners engaged (unique partner users in active projects)
  let partnersEngaged = 0;
  {
    const membersQuery = admin
      .from("project_members")
      .select("user_id, project:projects!inner(school_id, status), user:users!inner(role)")
      .is("left_at", null);
    const { data } = await membersQuery;
    const uniquePartners = new Set<string>();
    for (const m of data ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = (m.project as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u = (m.user as any);
      if (!p || !u) continue;
      if (p.status !== "active") continue;
      if (!isDistrictAdmin && p.school_id !== profile.school_id) continue;
      if (u.role === "partner") uniquePartners.add(m.user_id);
    }
    partnersEngaged = uniquePartners.size;
  }

  // Metric 3: messages this week
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const messagesQuery = admin
    .from("messages")
    .select("id, project:projects!inner(school_id)", { count: "exact", head: false })
    .is("deleted_at", null)
    .gte("created_at", oneWeekAgo);
  if (!isDistrictAdmin) messagesQuery.eq("project.school_id", profile.school_id);
  const { count: messagesThisWeek } = await messagesQuery;

  // Metric 4: flags pending review
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

  // Recent flags list (top 5)
  const { data: recentFlags } = await admin
    .from("content_flags")
    .select(
      "id, flag_type, matched_text, was_blocked, created_at, sender:users!sender_id(full_name), project:projects!project_id(id, name, school_id)"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <main className="min-h-screen bg-[#F2F5FA] text-foreground">
      <AppHeader
        profile={profile}
        canInvite
        canCreateProject
      />

      <div className="mx-auto max-w-6xl px-6 py-8 grid gap-8 lg:grid-cols-[200px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <AdminNav active="/admin" />
        </aside>

        <div className="space-y-8 min-w-0">
          <div>
            <h1 className="font-serif text-3xl text-navy">Dashboard</h1>
            <p className="text-sm text-neutral-dark mt-1">
              {isDistrictAdmin ? "District-wide overview" : "Your school"}
            </p>
          </div>

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

          <section className="bg-surface rounded-xl border border-brand-border p-6 space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-xl text-navy">Recent content flags</h2>
              <Link
                href="/admin/flags"
                className="text-xs text-neutral-dark hover:text-navy"
              >
                View all →
              </Link>
            </div>
            {(!recentFlags || recentFlags.length === 0) ? (
              <p className="text-sm text-neutral-dark italic py-4 text-center">
                Nothing to review. 🎉
              </p>
            ) : (
              <ul className="space-y-3">
                {recentFlags.map((f) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const s = (f.sender as any);
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const p = (f.project as any);
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
      className={`rounded-xl border p-5 bg-surface transition ${
        emphasize
          ? "border-warning/40 bg-warning/5"
          : "border-brand-border"
      } ${href ? "hover:border-navy cursor-pointer" : ""}`}
    >
      <div className="text-[11px] uppercase tracking-[0.15em] text-neutral-dark">
        {label}
      </div>
      <div className={`font-serif text-3xl mt-2 ${emphasize ? "text-warning" : "text-navy"}`}>
        {value}
      </div>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
