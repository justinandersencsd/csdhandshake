import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logout } from "./login/actions";
import Link from "next/link";
import { ProjectCard } from "@/components/project-card";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, role, email, coc_accepted_at, organization, school_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  // Gate partners on COC, students on AUP
  if (!profile.coc_accepted_at) {
    if (profile.role === "partner") redirect("/onboarding/coc");
    if (profile.role === "student") redirect("/onboarding/aup");
  }

  const isTeacher = profile.role === "teacher";
  const isAdmin = profile.role === "school_admin" || profile.role === "district_admin";
  const canInvite = isTeacher || isAdmin;

  // Get projects where user is a member
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

  // Get members per project
  const { data: allMembers } = projectIds.length
    ? await supabase
        .from("project_members")
        .select("project_id, user:users!user_id(full_name, role)")
        .in("project_id", projectIds)
        .is("left_at", null)
    : { data: [] };

  // Get latest message per project (parallel)
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

  const activeProjects = (projects ?? []).filter((p) => p.status === "active");
  const archivedProjects = (projects ?? []).filter((p) => p.status === "archived");

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

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-brand-border bg-surface">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-medium text-navy">CSD Handshake</h1>
          <div className="flex items-center gap-4">
            {isTeacher && (
              <Link
                href="/projects/new"
                className="text-sm rounded-md bg-navy text-surface px-3 py-1.5 hover:bg-navy-soft transition"
              >
                + New project
              </Link>
            )}
            {canInvite && (
              <Link
                href="/admin/invite"
                className="text-sm text-neutral-dark hover:text-navy"
              >
                Invite user
              </Link>
            )}
            <span className="text-sm text-neutral-dark">{profile.full_name}</span>
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

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-neutral-dark uppercase tracking-wide">
            Active projects
          </h2>
          {activeProjects.length === 0 ? (
            <EmptyState role={profile.role} />
          ) : (
            <div className="space-y-3">
              {activeProjects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  members={membersFor(p.id)}
                  lastMessage={lastMessageFor(p.id)}
                />
              ))}
            </div>
          )}
        </section>

        {archivedProjects.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-neutral-dark uppercase tracking-wide">
              Archived
            </h2>
            <div className="space-y-3">
              {archivedProjects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  members={membersFor(p.id)}
                  lastMessage={lastMessageFor(p.id)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function EmptyState({ role }: { role: string }) {
  const copy = {
    teacher:
      "You haven't created any projects yet. Click “+ New project” above to get started.",
    student: "You haven't been added to any projects yet. Your teacher will invite you.",
    partner: "You haven't been added to any projects yet.",
    school_admin:
      "You're not a member of any projects. Admin-wide views are coming in the admin dashboard.",
    district_admin:
      "You're not a member of any projects. Admin-wide views are coming in the admin dashboard.",
  } as Record<string, string>;
  return (
    <div className="border border-dashed border-brand-border rounded-lg p-8 bg-surface text-center text-sm text-neutral-dark">
      {copy[role] ?? "No projects to show."}
    </div>
  );
}
