import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { MessageComposer } from "@/components/message-composer";
import { MessageItem } from "@/components/message-item";
import { AppHeader } from "@/components/app-header";
import { initials } from "@/lib/format";

type Role = "student" | "partner" | "teacher" | "school_admin" | "district_admin";

const roleColor: Record<string, string> = {
  student: "bg-role-student-bg text-role-student-text",
  partner: "bg-role-partner-bg text-role-partner-text",
  teacher: "bg-role-teacher-bg text-role-teacher-text",
  school_admin: "bg-role-admin-bg text-role-admin-text",
  district_admin: "bg-role-admin-bg text-role-admin-text",
};

const roleLabel: Record<string, string> = {
  student: "Student",
  partner: "Partner",
  teacher: "Teacher",
  school_admin: "School Admin",
  district_admin: "District Admin",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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
      `
      id, name, description, status, partner_organization, school_id, created_by, archived_at, created_at,
      school:schools(name)
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (!project) notFound();

  const { data: members } = await supabase
    .from("project_members")
    .select("project_role, added_at, user:users!user_id(id, full_name, role, organization)")
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
  const visibleMessages = (messages ?? []).filter((m) => !m.deleted_at || isAdmin);
  const messageCount = visibleMessages.length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schoolName = (project.school as any)?.name ?? null;

  return (
    <main className="min-h-screen bg-[#F2F5FA] text-foreground flex flex-col">
      <AppHeader
        profile={profile}
        canInvite={canInvite}
        canCreateProject={canCreate}
      />

      {/* Project context strip */}
      <div className="border-b border-brand-border bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-4">
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
                {archived && (
                  <span className="text-[10px] uppercase tracking-widest bg-muted text-neutral-dark px-2 py-0.5 rounded-full shrink-0">
                    Archived
                  </span>
                )}
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
                {messageCount > 0 && (
                  <>
                    <span className="text-brand-border">·</span>
                    <span>
                      {messageCount} message{messageCount === 1 ? "" : "s"}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content: messages + sidebar */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Messages column */}
        <div className="flex-1 flex flex-col bg-surface lg:border-r border-brand-border min-w-0">
          <div className="flex-1">
            <div className="mx-auto max-w-3xl px-6 py-6">
              {!isMember && isAdmin && (
                <div className="bg-accent text-navy text-sm p-3 rounded-md mb-6 border border-brand-border flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-navy shrink-0" />
                  You&apos;re viewing this project as an admin. Admin views are
                  logged.
                </div>
              )}

              {visibleMessages.length === 0 ? (
                <div className="flex items-center justify-center min-h-[400px]">
                  <div className="text-center space-y-2 px-8">
                    <p className="font-serif text-3xl text-navy italic">
                      Quiet here
                    </p>
                    <p className="text-sm text-neutral-dark">
                      {isMember
                        ? "Be the first to post below."
                        : "No messages yet in this project."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-brand-border">
                  {visibleMessages.map((m) => (
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
            </div>
          </div>

          {isMember && (
            <div className="sticky bottom-0 bg-surface">
              <div className="mx-auto max-w-3xl">
                <MessageComposer projectId={id} disabled={archived} />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 border-brand-border">
          <div className="p-6 space-y-6 lg:sticky lg:top-14">
            {/* About */}
            <section className="space-y-2.5">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-dark">
                About
              </h3>
              {project.description ? (
                <p className="text-sm text-navy/80 leading-relaxed">
                  {project.description}
                </p>
              ) : (
                <p className="text-sm text-neutral-dark italic">
                  No description added
                </p>
              )}
              <dl className="text-xs text-neutral-dark space-y-1 pt-1">
                {schoolName && (
                  <div>
                    <dt className="inline text-neutral-dark">School: </dt>
                    <dd className="inline text-navy font-medium">
                      {schoolName}
                    </dd>
                  </div>
                )}
                {project.created_at && (
                  <div>
                    <dt className="inline text-neutral-dark">Started: </dt>
                    <dd className="inline text-navy font-medium">
                      {formatDate(project.created_at)}
                    </dd>
                  </div>
                )}
              </dl>
            </section>

            {/* Partner */}
            {project.partner_organization && (
              <section className="space-y-2">
                <h3 className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-dark">
                  Partner
                </h3>
                <div className="bg-role-partner-bg text-role-partner-text px-4 py-3 rounded-lg">
                  <div className="font-serif text-lg leading-tight">
                    {project.partner_organization}
                  </div>
                </div>
              </section>
            )}

            {/* Members */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-dark">
                Members {members?.length ? `· ${members.length}` : ""}
              </h3>
              <ul className="space-y-2.5">
                {(members ?? []).map((m) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const u = m.user as any;
                  if (!u) return null;
                  const role = u.role as Role;
                  return (
                    <li key={u.id} className="flex items-start gap-2.5">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0 ${
                          roleColor[role] ?? "bg-muted text-foreground"
                        }`}
                        title={u.full_name}
                      >
                        {initials(u.full_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-navy font-medium truncate">
                          {u.full_name}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-neutral-dark">
                          <span>{roleLabel[role] ?? role}</span>
                          {m.project_role === "owner" && (
                            <>
                              <span className="text-brand-border">·</span>
                              <span className="uppercase tracking-wider">
                                Owner
                              </span>
                            </>
                          )}
                          {u.organization && (
                            <>
                              <span className="text-brand-border">·</span>
                              <span className="truncate">{u.organization}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Settings link */}
            {canSettings && (
              <div className="pt-2 border-t border-brand-border">
                <Link
                  href={`/projects/${id}/settings`}
                  className="inline-flex items-center gap-1 text-sm text-navy hover:text-navy-soft transition font-medium"
                >
                  Project settings →
                </Link>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
