import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { MessageComposer } from "@/components/message-composer";
import { MessageItem } from "@/components/message-item";
import { initials, relativeTime } from "@/lib/format";

const ROLE_COLORS: Record<string, string> = {
  student: "bg-role-student/15 text-role-student",
  partner: "bg-role-partner/15 text-role-partner",
  teacher: "bg-role-teacher/15 text-role-teacher",
  school_admin: "bg-role-admin/15 text-role-admin",
  district_admin: "bg-role-admin/15 text-role-admin",
};

export default async function ProjectPage({
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
    .select("full_name, role, email, organization, school_id")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("*, school:schools!school_id(name)")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const isTeacher = profile.role === "teacher";
  const isAdmin =
    profile.role === "school_admin" || profile.role === "district_admin";
  const canSettings = isTeacher || isAdmin || project.created_by === user.id;

  const { data: members } = await supabase
    .from("project_members")
    .select(
      "user_id, project_role, added_at, user:users!user_id(full_name, role, organization, email)"
    )
    .eq("project_id", id)
    .is("left_at", null);

  const { data: messages } = await supabase
    .from("messages")
    .select(
      "id, body, link_url, created_at, edited_at, deleted_at, deleted_by, sender_id, pending_review, sender:users!sender_id(full_name, role, organization)"
    )
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  const pendingCount = (messages ?? []).filter((m) => m.pending_review).length;
  const owner = members?.find((m) => m.user_id === project.created_by);

  return (
    <main className="min-h-screen bg-[#F2F5FA] text-foreground">
      <AppHeader
        profile={profile}
        canInvite={isTeacher || isAdmin}
        canCreateProject={isTeacher || isAdmin}
      />

      <div className="mx-auto max-w-6xl px-6 py-8 grid gap-8 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0 space-y-6">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <Link
                href="/"
                className="text-xs text-neutral-dark hover:text-navy"
              >
                ← All projects
              </Link>
              <h1 className="font-serif text-3xl text-navy leading-tight">
                {project.name}
              </h1>
              {project.status === "archived" && (
                <span className="inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-neutral-200 text-neutral-700">
                  Archived
                </span>
              )}
            </div>
          </div>

          {(isTeacher || isAdmin) && pendingCount > 0 && (
            <div className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-navy">
              <strong>{pendingCount}</strong> {pendingCount === 1 ? "message" : "messages"} pending your review.
              Look for the &ldquo;Pending review&rdquo; tag below and click &ldquo;Approve&rdquo;.
            </div>
          )}

          <div className="bg-surface rounded-xl border border-brand-border p-5 space-y-6">
            {(!messages || messages.length === 0) ? (
              <p className="text-sm text-neutral-dark italic text-center py-8">
                No messages yet. Start the conversation below.
              </p>
            ) : (
              messages.map((m) => (
                <MessageItem
                  key={m.id}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  message={m as any}
                  currentUserId={user.id}
                  isAdmin={isAdmin}
                  isTeacher={isTeacher}
                  projectId={id}
                />
              ))
            )}
          </div>

          {project.status === "active" && (
            <MessageComposer projectId={id} />
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.15em] text-neutral-dark">
              About
            </div>
            {project.description ? (
              <p className="text-sm text-navy-soft">{project.description}</p>
            ) : (
              <p className="text-sm text-neutral-dark italic">No description.</p>
            )}
            <div className="pt-1 text-xs text-neutral-dark">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(project.school as any)?.name}
            </div>
            <div className="text-xs text-neutral-dark">
              Started {relativeTime(project.created_at)}
            </div>
          </div>

          {project.partner_organization && (
            <div className="rounded-lg bg-warning/8 border border-warning/20 px-4 py-3 space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-neutral-dark">
                Partner
              </div>
              <div className="font-serif text-base text-navy italic">
                {project.partner_organization}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.15em] text-neutral-dark">
              Members · {members?.length ?? 0}
            </div>
            <ul className="space-y-2">
              {members?.map((m) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const u = m.user as any;
                const isOwner = m.user_id === project.created_by;
                return (
                  <li
                    key={m.user_id}
                    className="flex items-start gap-2 text-xs"
                  >
                    <div className="h-7 w-7 flex-shrink-0 rounded-full bg-navy text-white flex items-center justify-center text-[10px] font-medium">
                      {initials(u?.full_name ?? "")}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-medium text-navy truncate">
                        {u?.full_name}
                        {isOwner && (
                          <span className="ml-1 text-[9px] text-neutral-dark uppercase">
                            · Owner
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[9px] uppercase tracking-wider px-1 py-0.5 rounded ${ROLE_COLORS[u?.role] ?? "bg-neutral-100"}`}
                        >
                          {u?.role?.replace("_", " ")}
                        </span>
                        {u?.organization && (
                          <span className="text-[11px] text-neutral-dark truncate">
                            {u.organization}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {canSettings && (
            <div className="pt-2 border-t border-brand-border/50">
              <Link
                href={`/projects/${id}/settings`}
                className="text-xs text-neutral-dark hover:text-navy"
              >
                Project settings →
              </Link>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
