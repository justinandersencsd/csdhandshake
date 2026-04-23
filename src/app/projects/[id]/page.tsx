import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { MessageComposer } from "@/components/message-composer";
import { MessageItem } from "@/components/message-item";
import { RoleBadge } from "@/components/role-badge";
import { initials } from "@/lib/format";

export default async function ProjectThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, role, coc_accepted_at, school_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  if (!profile.coc_accepted_at) {
    if (profile.role === "partner") redirect("/onboarding/coc");
    if (profile.role === "student") redirect("/onboarding/aup");
  }

  const isAdmin =
    profile.role === "school_admin" || profile.role === "district_admin";

  // Get project (RLS protects this)
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status, partner_organization, school_id, created_by, archived_at")
    .eq("id", id)
    .maybeSingle();

  if (!project) notFound();

  // Get members
  const { data: members } = await supabase
    .from("project_members")
    .select("project_role, user:users!user_id(id, full_name, role)")
    .eq("project_id", id)
    .is("left_at", null);

  // Is the current user a member?
  const isMember = members?.some((m) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (m.user as any)?.id === user.id;
  });

  const isOwner = project.created_by === user.id;
  const canSettings = isOwner || isAdmin;

  // Get messages (RLS-filtered)
  const { data: messages } = await supabase
    .from("messages")
    .select(
      `
      id, body, attachment_url, attachment_label, created_at, edited_at, deleted_at, pending_review,
      sender:users!sender_id(id, full_name, role)
    `
    )
    .eq("project_id", id)
    .eq("pending_review", false)
    .order("created_at", { ascending: true });

  // Get owner info for header
  const ownerMember = members?.find((m) => m.project_role === "owner");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ownerName = (ownerMember?.user as any)?.full_name ?? "Unknown";

  const archived = project.status === "archived";

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-brand-border bg-surface">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="text-sm text-neutral-dark hover:text-navy shrink-0">
              ←
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-medium text-navy truncate">{project.name}</h1>
              <p className="text-xs text-neutral-dark truncate">
                {project.partner_organization
                  ? `${project.partner_organization} · `
                  : ""}
                Owner: {ownerName}
                {archived && " · Archived"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex -space-x-2">
              {(members ?? []).slice(0, 5).map((m) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const u = m.user as any;
                if (!u) return null;
                const color =
                  u.role === "student"
                    ? "bg-role-student-bg text-role-student-text"
                    : u.role === "partner"
                    ? "bg-role-partner-bg text-role-partner-text"
                    : u.role === "teacher"
                    ? "bg-role-teacher-bg text-role-teacher-text"
                    : "bg-role-admin-bg text-role-admin-text";
                return (
                  <div
                    key={u.id}
                    title={`${u.full_name} (${u.role})`}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 border-surface ${color}`}
                  >
                    {initials(u.full_name)}
                  </div>
                );
              })}
              {(members?.length ?? 0) > 5 && (
                <div className="w-8 h-8 rounded-full bg-muted text-neutral-dark text-xs flex items-center justify-center border-2 border-surface font-medium">
                  +{(members?.length ?? 0) - 5}
                </div>
              )}
            </div>
            {canSettings && (
              <Link
                href={`/projects/${id}/settings`}
                className="text-sm text-neutral-dark hover:text-navy"
              >
                Settings
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-4">
          {!isMember && isAdmin && (
            <div className="bg-accent text-navy text-sm p-3 rounded mb-4">
              You&apos;re viewing this project as an admin. Admin views are logged.
            </div>
          )}

          {!messages || messages.length === 0 ? (
            <div className="border border-dashed border-brand-border rounded-lg p-8 bg-surface text-center text-sm text-neutral-dark my-4">
              No messages yet. Be the first to post below.
            </div>
          ) : (
            <div className="divide-y divide-brand-border">
              {messages.map((m) => (
                <MessageItem
                  key={m.id}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  message={m as any}
                  currentUserId={user.id}
                  isAdmin={isAdmin}
                  projectId={id}
                  projectArchived={archived}
                />
              ))}
            </div>
          )}

          {/* Members list (collapsed-ish for now) */}
          <details className="mt-6 text-sm">
            <summary className="cursor-pointer text-neutral-dark hover:text-navy">
              {members?.length ?? 0} member{members?.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-2 space-y-1">
              {(members ?? []).map((m) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const u = m.user as any;
                if (!u) return null;
                return (
                  <li key={u.id} className="flex items-center gap-2 text-sm">
                    <span className="text-navy">{u.full_name}</span>
                    <RoleBadge role={u.role} size="xs" />
                    {m.project_role === "owner" && (
                      <span className="text-xs text-neutral-dark">· Owner</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        </div>
      </div>

      {isMember && (
        <div className="sticky bottom-0">
          <div className="max-w-4xl mx-auto">
            <MessageComposer projectId={id} disabled={archived} />
          </div>
        </div>
      )}
    </main>
  );
}
