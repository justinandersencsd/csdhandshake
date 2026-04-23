import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { MessageComposer } from "@/components/message-composer";
import { MessageItem } from "@/components/message-item";
import { RoleBadge } from "@/components/role-badge";
import { AppHeader } from "@/components/app-header";
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
    .select("full_name, role, email, coc_accepted_at, school_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  if (!profile.coc_accepted_at) {
    if (profile.role === "partner") redirect("/onboarding/coc");
    if (profile.role === "student") redirect("/onboarding/aup");
  }

  const isAdmin =
    profile.role === "school_admin" || profile.role === "district_admin";
  const isTeacher = profile.role === "teacher";
  const canInvite = isTeacher || isAdmin;
  const canCreate = isTeacher || isAdmin;

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, status, partner_organization, school_id, created_by, archived_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!project) notFound();

  const { data: members } = await supabase
    .from("project_members")
    .select("project_role, user:users!user_id(id, full_name, role)")
    .eq("project_id", id)
    .is("left_at", null);

  const isMember = members?.some((m) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (m.user as any)?.id === user.id;
  });

  const isOwner = project.created_by === user.id;
  const canSettings = isOwner || isAdmin;

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

  const ownerMember = members?.find((m) => m.project_role === "owner");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ownerName = (ownerMember?.user as any)?.full_name ?? "Unknown";

  const archived = project.status === "archived";

  return (
    <main className="min-h-screen bg-surface text-foreground flex flex-col">
      <AppHeader
        profile={profile}
        canInvite={canInvite}
        canCreateProject={canCreate}
      />

      {/* Project context strip */}
      <div className="border-b border-brand-border bg-surface">
        <div className="mx-auto max-w-4xl px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="text-neutral-dark hover:text-navy shrink-0 text-sm"
              aria-label="Back to projects"
            >
              ←
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 mb-0.5">
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    archived ? "bg-neutral-dark/30" : "bg-success-text"
                  }`}
                  aria-hidden="true"
                />
                <h1 className="font-serif text-2xl text-navy leading-none truncate">
                  {project.name}
                </h1>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-dark ml-[18px]">
                {project.partner_organization && (
                  <>
                    <span className="font-medium text-navy">
                      {project.partner_organization}
                    </span>
                    <span className="text-brand-border">·</span>
                  </>
                )}
                <span>Owner: {ownerName}</span>
                {archived && (
                  <>
                    <span className="text-brand-border">·</span>
                    <span className="uppercase tracking-wider text-[10px] text-warning-text font-medium">
                      Archived
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex -space-x-1.5">
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
                    title={`${u.full_name} (${u.role.replace("_", " ")})`}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium border-2 border-surface ${color}`}
                  >
                    {initials(u.full_name)}
                  </div>
                );
              })}
              {(members?.length ?? 0) > 5 && (
                <div className="w-7 h-7 rounded-full bg-muted text-neutral-dark text-[10px] flex items-center justify-center border-2 border-surface font-medium">
                  +{(members?.length ?? 0) - 5}
                </div>
              )}
            </div>
            {canSettings && (
              <Link
                href={`/projects/${id}/settings`}
                className="text-sm text-neutral-dark hover:text-navy transition"
              >
                Settings
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-6">
          {!isMember && isAdmin && (
            <div className="bg-accent text-navy text-sm p-3 rounded-md mb-6 border border-brand-border">
              You&apos;re viewing this project as an admin. Admin views are logged.
            </div>
          )}

          {!messages || messages.length === 0 ? (
            <div className="border border-dashed border-brand-border rounded-xl px-8 py-16 bg-surface text-center my-4">
              <p className="font-serif text-2xl text-navy italic mb-1">
                Quiet here
              </p>
              <p className="text-sm text-neutral-dark">
                Be the first to post below.
              </p>
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

          <details className="mt-8 text-sm group">
            <summary className="cursor-pointer text-neutral-dark hover:text-navy inline-flex items-center gap-1.5">
              <span className="text-[11px] uppercase tracking-widest">
                {members?.length ?? 0} member{members?.length === 1 ? "" : "s"}
              </span>
              <span className="text-xs group-open:rotate-90 transition-transform">›</span>
            </summary>
            <ul className="mt-3 space-y-1.5">
              {(members ?? []).map((m) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const u = m.user as any;
                if (!u) return null;
                return (
                  <li key={u.id} className="flex items-center gap-2 text-sm">
                    <span className="text-navy">{u.full_name}</span>
                    <RoleBadge role={u.role} size="xs" />
                    {m.project_role === "owner" && (
                      <span className="text-[10px] uppercase tracking-wider text-neutral-dark">
                        Owner
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        </div>
      </div>

      {isMember && (
        <div className="sticky bottom-0 bg-surface">
          <div className="mx-auto max-w-4xl">
            <MessageComposer projectId={id} disabled={archived} />
          </div>
        </div>
      )}
    </main>
  );
}
