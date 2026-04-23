import Link from "next/link";
import { Logo } from "./logo";
import { NotificationsBell } from "./notifications-bell";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { initials } from "@/lib/format";

type Profile = {
  full_name: string;
  role: string;
  email?: string | null;
  organization?: string | null;
};

export async function AppHeader({
  profile,
  canInvite,
  canCreateProject,
}: {
  profile: Profile;
  canInvite?: boolean;
  canCreateProject?: boolean;
}) {
  const isAdmin =
    profile.role === "school_admin" || profile.role === "district_admin";

  // Fetch unread counts for bell
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let bellProjects: Array<{
    id: string;
    name: string;
    count: number;
    lastMessageAt: string | null;
  }> = [];
  let totalUnread = 0;

  if (user) {
    const { data: memberships } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", user.id)
      .is("left_at", null);

    const projectIds = memberships?.map((m) => m.project_id) ?? [];

    if (projectIds.length > 0) {
      const { data: reads } = await supabase
        .from("message_reads")
        .select("project_id, last_read_at")
        .eq("user_id", user.id)
        .in("project_id", projectIds);

      const readMap = new Map(
        (reads ?? []).map((r) => [r.project_id, r.last_read_at])
      );

      const { data: projects } = await supabase
        .from("projects")
        .select("id, name, updated_at")
        .in("id", projectIds)
        .eq("status", "active");

      const rawCounts = await Promise.all(
        (projects ?? []).map(async (p) => {
          const lastRead = readMap.get(p.id);
          const q = supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("project_id", p.id)
            .is("deleted_at", null)
            .is("pending_review", false)
            .neq("sender_id", user.id);
          if (lastRead) q.gt("created_at", lastRead);
          const { count } = await q;
          return {
            id: p.id,
            name: p.name,
            count: count ?? 0,
            lastMessageAt: p.updated_at,
          };
        })
      );

      bellProjects = rawCounts
        .filter((p) => p.count > 0)
        .sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
      totalUnread = bellProjects.reduce((sum, p) => sum + p.count, 0);
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur border-b border-brand-border">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 min-w-0 group">
          <Logo />
          <span className="font-serif italic text-2xl text-navy leading-none hidden sm:inline">
            Handshake
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {canCreateProject && (
            <Link
              href="/projects/new"
              className="hidden sm:inline-flex items-center px-3 py-1.5 text-xs rounded-md bg-navy text-white hover:bg-navy-soft transition"
            >
              + New project
            </Link>
          )}

          {canInvite && (
            <Link
              href="/admin/invite"
              className="hidden md:inline-flex items-center px-3 py-1.5 text-xs rounded-md border border-brand-border text-neutral-dark hover:border-navy hover:text-navy transition"
            >
              Invite
            </Link>
          )}

          {isAdmin && (
            <Link
              href="/admin"
              className="hidden md:inline-flex items-center px-3 py-1.5 text-xs rounded-md border border-brand-border text-neutral-dark hover:border-navy hover:text-navy transition"
            >
              Admin
            </Link>
          )}

          <NotificationsBell projects={bellProjects} totalUnread={totalUnread} />

          <details className="relative">
            <summary className="list-none cursor-pointer flex items-center gap-2 px-2 py-1 rounded-md hover:bg-neutral-100 transition [&::-webkit-details-marker]:hidden">
              <div className="h-7 w-7 rounded-full bg-navy text-white flex items-center justify-center text-[10px] font-medium">
                {initials(profile.full_name)}
              </div>
              <span className="hidden sm:inline text-xs text-navy">
                {profile.full_name.split(/\s+/)[0]}
              </span>
            </summary>
            <div className="absolute right-0 mt-1 w-56 bg-surface rounded-md border border-brand-border shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-brand-border">
                <div className="text-sm text-navy truncate">
                  {profile.full_name}
                </div>
                <div className="text-[11px] text-neutral-dark truncate">
                  {profile.email}
                </div>
              </div>
              <Link
                href="/settings"
                className="block px-3 py-2 text-xs text-neutral-dark hover:bg-neutral-50 hover:text-navy"
              >
                Settings
              </Link>
              <form action={logout}>
                <button className="w-full text-left px-3 py-2 text-xs text-neutral-dark hover:bg-neutral-50 hover:text-navy">
                  Sign out
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
