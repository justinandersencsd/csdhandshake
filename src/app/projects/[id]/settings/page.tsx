import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { AddMemberForm } from "@/components/add-member-form";
import {
  updateProject,
  updateSafetySettings,
  archiveProject,
  unarchiveProject,
  removeMember,
} from "./actions";

const ROLE_COLORS: Record<string, string> = {
  student: "bg-role-student/15 text-role-student",
  partner: "bg-role-partner/15 text-role-partner",
  teacher: "bg-role-teacher/15 text-role-teacher",
  school_admin: "bg-role-admin/15 text-role-admin",
  district_admin: "bg-role-admin/15 text-role-admin",
};

export default async function ProjectSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role, school_id, full_name, email")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  const isAdmin =
    profile.role === "school_admin" || profile.role === "district_admin";
  const isTeacher = profile.role === "teacher";

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const isOwner = project.created_by === user.id;
  if (!isOwner && !isAdmin) redirect(`/projects/${id}`);

  const { data: members } = await supabase
    .from("project_members")
    .select(
      "user_id, project_role, added_at, user:users!user_id(full_name, role, organization, email)"
    )
    .eq("project_id", id)
    .is("left_at", null);

  const error = typeof sp.error === "string" ? sp.error : null;
  const success = typeof sp.success === "string" ? sp.success : null;

  const quietStart = (project.quiet_hours_start ?? "20:00:00").slice(0, 5);
  const quietEnd = (project.quiet_hours_end ?? "08:00:00").slice(0, 5);

  return (
    <main className="min-h-screen bg-[#F2F5FA] text-foreground">
      <AppHeader
        profile={profile}
        canInvite={isTeacher || isAdmin}
        canCreateProject={isTeacher || isAdmin}
      />

      <div className="mx-auto max-w-3xl px-6 py-8 space-y-8">
        <div>
          <Link
            href={`/projects/${id}`}
            className="text-xs text-neutral-dark hover:text-navy"
          >
            ← Back to project
          </Link>
          <h1 className="font-serif text-3xl text-navy mt-2">
            Project settings
          </h1>
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

        {/* General */}
        <section className="bg-surface rounded-xl border border-brand-border p-6 space-y-4">
          <h2 className="font-serif text-xl text-navy">General</h2>
          <form action={updateProject} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <div>
              <label className="text-xs text-neutral-dark">Name</label>
              <input
                name="name"
                required
                defaultValue={project.name}
                className="mt-1 w-full rounded-md border border-brand-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-dark">Description</label>
              <textarea
                name="description"
                defaultValue={project.description ?? ""}
                className="mt-1 w-full rounded-md border border-brand-border px-3 py-2 text-sm min-h-[80px]"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-dark">
                Partner organization
              </label>
              <input
                name="partner_organization"
                defaultValue={project.partner_organization ?? ""}
                className="mt-1 w-full rounded-md border border-brand-border px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end">
              <button className="px-4 py-2 rounded-md bg-navy text-white text-sm">
                Save changes
              </button>
            </div>
          </form>
        </section>

        {/* Safety */}
        <section className="bg-surface rounded-xl border border-brand-border p-6 space-y-4">
          <div>
            <h2 className="font-serif text-xl text-navy">Safety</h2>
            <p className="text-xs text-neutral-dark mt-1">
              Extra guardrails for partner communication. Applies to messages
              from partners; students and teachers are unaffected.
            </p>
          </div>

          <form action={updateSafetySettings} className="space-y-5">
            <input type="hidden" name="id" value={id} />

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  name="first_message_review_enabled"
                  defaultChecked={project.first_message_review_enabled ?? false}
                  className="rounded"
                />
                Review partner&apos;s first messages before they post
              </label>
              <div className="ml-6 flex items-center gap-2 text-xs text-neutral-dark">
                <span>Auto-release after</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  name="first_message_review_count"
                  defaultValue={project.first_message_review_count ?? 3}
                  className="w-14 rounded border border-brand-border px-2 py-1 text-sm text-center"
                />
                <span>approved messages</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  name="quiet_hours_enabled"
                  defaultChecked={project.quiet_hours_enabled ?? false}
                  className="rounded"
                />
                Quiet hours (block partner messages during window)
              </label>
              <div className="ml-6 flex items-center gap-2 text-xs text-neutral-dark">
                <input
                  type="time"
                  name="quiet_hours_start"
                  defaultValue={quietStart}
                  className="rounded border border-brand-border px-2 py-1 text-sm"
                />
                <span>to</span>
                <input
                  type="time"
                  name="quiet_hours_end"
                  defaultValue={quietEnd}
                  className="rounded border border-brand-border px-2 py-1 text-sm"
                />
                <span>(school timezone)</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  name="rate_limit_enabled"
                  defaultChecked={project.rate_limit_enabled ?? false}
                  className="rounded"
                />
                Rate limit partner messages
              </label>
              <div className="ml-6 flex items-center gap-2 text-xs text-neutral-dark">
                <span>Max</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  name="rate_limit_per_hour"
                  defaultValue={project.rate_limit_per_hour ?? 10}
                  className="w-14 rounded border border-brand-border px-2 py-1 text-sm text-center"
                />
                <span>messages per hour</span>
              </div>
            </div>

            <div className="flex justify-end">
              <button className="px-4 py-2 rounded-md bg-navy text-white text-sm">
                Save safety settings
              </button>
            </div>
          </form>
        </section>

        {/* Members */}
        <section className="bg-surface rounded-xl border border-brand-border p-6 space-y-4">
          <h2 className="font-serif text-xl text-navy">Members</h2>
          <ul className="space-y-2">
            {members?.map((m) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const u = m.user as any;
              const isProjectOwner = m.user_id === project.created_by;
              return (
                <li
                  key={m.user_id}
                  className="flex items-center justify-between py-2 border-b border-brand-border/50 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="text-sm font-medium text-navy">
                        {u?.full_name}
                        {isProjectOwner && (
                          <span className="ml-2 text-[10px] text-neutral-dark uppercase tracking-wider">
                            Owner
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-dark flex items-center gap-2">
                        <span
                          className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${ROLE_COLORS[u?.role] ?? "bg-neutral-100"}`}
                        >
                          {u?.role?.replace("_", " ")}
                        </span>
                        {u?.email}
                      </div>
                    </div>
                  </div>
                  {!isProjectOwner && (
                    <form action={removeMember}>
                      <input type="hidden" name="project_id" value={id} />
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <button className="text-xs text-neutral-dark hover:text-danger">
                        Remove
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="pt-3 border-t border-brand-border/50">
            <AddMemberForm projectId={id} />
          </div>
        </section>

        {/* Danger zone */}
        <section className="bg-surface rounded-xl border border-danger/30 p-6 space-y-3">
          <h2 className="font-serif text-xl text-danger">Danger zone</h2>
          {project.status === "active" ? (
            <>
              <p className="text-sm text-neutral-dark">
                Archiving hides the project from active lists. Messages remain
                accessible. You can unarchive later.
              </p>
              <form action={archiveProject}>
                <input type="hidden" name="id" value={id} />
                <button className="px-4 py-2 rounded-md bg-danger text-white text-sm">
                  Archive project
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm text-neutral-dark">
                This project is archived. Unarchive to resume messaging.
              </p>
              <form action={unarchiveProject}>
                <input type="hidden" name="id" value={id} />
                <button className="px-4 py-2 rounded-md bg-navy text-white text-sm">
                  Unarchive project
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
