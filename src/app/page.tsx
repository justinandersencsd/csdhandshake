import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ProjectCard } from "@/components/project-card";
import { AppHeader } from "@/components/app-header";
import { TabTitleBadge } from "@/components/tab-title-badge";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, role, email, coc_accepted_at, organization, school_id, deactivated_at")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  if (profile.deactivated_at) {
    await supabase.auth.signOut();
    redirect("/login?error=Your+account+has+been+deactivated.");
  }

  if (!profile.coc_accepted_at) {
    if (profile.role === "partner") redirect("/onboarding/coc");
    if (profile.role === "student") redirect("/onboarding/aup");
  }

  const isTeacher = profile.role === "teacher";
  const isAdmin =
    profile.role === "school_admin" || profile.role === "district_admin";
  const canInvite = isTeacher || isAdmin;
  const canCreate = isTeacher || isAdmin;

  const { data: memberships } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", user.id)
    .is("left_at", null);

  const projectIds = memberships?.map((m) => m.project_id) ?? [];

  const { data: projects } = projectIds.length
    ? await supabase
        .from("projects")
        .select("id, name, status, partner_organization, school_id, updated_at")
        .in("id", projectIds)
        .order("updated_at", { ascending: false })
    : { data: [] };

  const { data: allMembers } = projectIds.length
    ? await supabase
        .from("project_members")
        .select("project_id, user:users!user_id(full_name, role)")
        .in("project_id", projectIds)
        .is("left_at", null)
    : { data: [] };

  const lastMessages = await Promise.all(
    (projects ?? []).map(async (p) => {
      const { data } = await supabase
        .from("messages")
        .select("body, created_at, sender:users!sender_id(full_name)")
        .eq("project_id", p.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { projectId: p.id, message: data };
    })
  );

  const lastMessageMap = new Map(
    lastMessages.map((lm) => [lm.projectId, lm.message])
  );

  const { data: reads } = projectIds.length
    ? await supabase
        .from("message_reads")
        .select("project_id, last_read_at")
        .eq("user_id", user.id)
        .in("project_id", projectIds)
    : { data: [] };

  const readMap = new Map(
    (reads ?? []).map((r) => [r.project_id, r.last_read_at])
  );

  const unreadCounts = await Promise.all(
    (projects ?? []).map(async (p) => {
      const lastRead = readMap.get(p.id);
      const query = supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("project_id", p.id)
        .is("deleted_at", null)
        .is("pending_review", false)
        .neq("sender_id", user.id);
      if (lastRead) query.gt("created_at", lastRead);
      const { count } = await query;
      return { projectId: p.id, count: count ?? 0 };
    })
  );

  const unreadMap = new Map(unreadCounts.map((u) => [u.projectId, u.count]));
  const totalUnread = unreadCounts.reduce((sum, u) => sum + u.count, 0);

  const activeProjects = (projects ?? []).filter((p) => p.status === "active");
  const archivedProjects = (projects ?? []).filter(
    (p) => p.status === "archived"
  );

  function membersFor(projectId: string) {
    return (
      allMembers
        ?.filter((m) => m.project_id === projectId)
        .map((m) => ({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          full_name: (m.user as any)?.full_name ?? "",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          role: (m.user as any)?.role ?? "",
        })) ?? []
    );
  }

  function lastMessageFor(projectId: string) {
    const m = lastMessageMap.get(projectId);
    if (!m) return null;
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sender_name: (m.sender as any)?.full_name ?? "Unknown",
      body: m.body,
      created_at: m.created_at,
    };
  }

  const firstName = profile.full_name.split(/\s+/)[0];
  const totalActive = activeProjects.length;

  return (
    <main className="min-h-screen bg-[#F2F5FA] text-foreground">
      <TabTitleBadge count={totalUnread} />
      <AppHeader
        profile={profile}
        canInvite={canInvite}
        canCreateProject={canCreate}
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10 space-y-8">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <h1 className="font-serif text-2xl sm:text-4xl text-navy leading-none">
              <span className="italic">Welcome back,</span> {firstName}
            </h1>
            <p className="text-sm text-neutral-dark">
              {totalActive === 0
                ? "You haven't been added to any active projects yet."
                : `${totalActive} active ${totalActive === 1 ? "project" : "projects"}`}
              {totalUnread > 0 && (
                <>
                  <span className="mx-1">·</span>
                  <span className="font-medium text-navy">
                    {totalUnread} unread
                  </span>
                </>
              )}
            </p>
          </div>
          {profile.organization && (
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-widest text-neutral-dark">
                Organization
              </div>
              <div className="font-serif text-lg text-navy">
                {profile.organization}
              </div>
            </div>
          )}
        </div>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-dark">
              Active projects
            </h2>
            {totalActive > 0 && (
              <span className="text-[11px] font-medium text-neutral-dark">
                {totalActive}
              </span>
            )}
          </div>

          {activeProjects.length === 0 ? (
            <EmptyState role={profile.role} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
              {activeProjects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  members={membersFor(p.id) as any}
                  lastMessage={lastMessageFor(p.id)}
                  unreadCount={unreadMap.get(p.id) ?? 0}
                />
              ))}
            </div>
          )}
        </section>

        {archivedProjects.length > 0 && (
          <details className="group space-y-3 [&>summary]:list-none [&>summary::-webkit-details-marker]:hidden">
            <summary className="cursor-pointer flex items-center justify-between py-2 text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-dark hover:text-navy transition">
              <span className="flex items-center gap-2">
                <span className="inline-block transition-transform duration-200 group-open:rotate-90 text-sm leading-none">
                  ›
                </span>
                Archived · {archivedProjects.length}
              </span>
            </summary>
            <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 pt-1">
              {archivedProjects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  members={membersFor(p.id) as any}
                  lastMessage={lastMessageFor(p.id)}
                  unreadCount={unreadMap.get(p.id) ?? 0}
                />
              ))}
            </div>
          </details>
        )}

        <footer className="pt-12 pb-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-[11px] text-neutral-dark/60 uppercase tracking-[0.2em]">
          <span>Canyons School District · Handshake</span>
          <div className="flex gap-3">
            <Link href="/legal/terms" className="hover:text-navy">Terms</Link>
            <Link href="/legal/privacy" className="hover:text-navy">Privacy</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

function EmptyState({ role }: { role: string }) {
  const copy = {
    teacher:
      'No active projects yet. Click "+ New project" in the header to start your first partnership.',
    student: "You haven't been added to any projects yet. Your teacher will invite you.",
    partner: "You haven't been added to any projects yet.",
    school_admin:
      "You're not a member of any projects. Visit /admin for the district overview.",
    district_admin:
      "You're not a member of any projects. Visit /admin for the district overview.",
  } as Record<string, string>;
  return (
    <div className="border border-dashed border-brand-border rounded-xl px-8 py-12 bg-surface text-center">
      <p className="text-sm text-neutral-dark max-w-md mx-auto">
        {copy[role] ?? "No projects to show."}
      </p>
    </div>
  );
}
