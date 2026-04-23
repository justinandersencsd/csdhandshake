import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  updateProject,
  archiveProject,
  unarchiveProject,
  removeMember,
} from "./actions";
import { RoleBadge } from "@/components/role-badge";
import { AddMemberForm } from "@/components/add-member-form";

export default async function ProjectSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
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
    .select("role, school_id")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  const isAdmin =
    profile.role === "school_admin" || profile.role === "district_admin";

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
    .select("project_role, added_at, user:users!user_id(id, full_name, email, role, organization)")
    .eq("project_id", id)
    .is("left_at", null);

  const archived = project.status === "archived";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-brand-border bg-surface">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href={`/projects/${id}`} className="text-lg font-medium text-navy">
            ← {project.name}
          </Link>
          <Link href="/" className="text-sm text-neutral-dark hover:text-navy">
            Home
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-medium text-navy">Project settings</h1>
        </div>

        {sp.error && (
          <div className="bg-danger-bg text-danger-text p-3 rounded text-sm">{sp.error}</div>
        )}
        {sp.success && (
          <div className="bg-success-bg text-success-text p-3 rounded text-sm">
            ✓ {sp.success}
          </div>
        )}

        {/* GENERAL */}
        <section className="border border-brand-border rounded-lg p-6 bg-surface space-y-4">
          <h2 className="font-medium text-navy">General</h2>
          <form action={updateProject} className="space-y-4">
            <input type="hidden" name="id" value={project.id} />

            <div className="space-y-1">
              <label htmlFor="name" className="text-sm font-medium text-navy">
                Project name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={project.name}
                disabled={archived}
                className="w-full rounded-md border border-brand-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="description" className="text-sm font-medium text-navy">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={project.description ?? ""}
                disabled={archived}
                className="w-full rounded-md border border-brand-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none disabled:opacity-50"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="partner_organization"
                className="text-sm font-medium text-navy"
              >
                Partner organization
              </label>
              <input
                id="partner_organization"
                name="partner_organization"
                type="text"
                defaultValue={project.partner_organization ?? ""}
                disabled={archived}
                className="w-full rounded-md border border-brand-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={archived}
              className="rounded-md bg-navy text-surface px-4 py-1.5 text-sm font-medium hover:bg-navy-soft transition disabled:opacity-50"
            >
              Save changes
            </button>
          </form>
        </section>

        {/* MEMBERS */}
        <section className="border border-brand-border rounded-lg p-6 bg-surface space-y-4">
          <h2 className="font-medium text-navy">Members</h2>

          <ul className="divide-y divide-brand-border">
            {(members ?? []).map((m) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const u = m.user as any;
              if (!u) return null;
              const isOwnerRow = m.project_role === "owner";
              return (
                <li key={u.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-navy text-sm">{u.full_name}</span>
                      <RoleBadge role={u.role} size="xs" />
                      {isOwnerRow && (
                        <span className="text-xs text-neutral-dark">Owner</span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-dark">
                      {u.email}
                      {u.organization ? ` · ${u.organization}` : ""}
                    </div>
                  </div>
                  {!isOwnerRow && !archived && (
                    <form action={removeMember}>
                      <input type="hidden" name="project_id" value={project.id} />
                      <input type="hidden" name="user_id" value={u.id} />
                      <button
                        type="submit"
                        className="text-xs text-neutral-dark hover:text-danger-text"
                      >
                        Remove
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>

          {!archived && <AddMemberForm projectId={project.id} />}
        </section>

        {/* DANGER ZONE */}
        <section className="border border-brand-border rounded-lg p-6 bg-surface space-y-4">
          <h2 className="font-medium text-navy">
            {archived ? "Archive status" : "Archive project"}
          </h2>
          {archived ? (
            <>
              <p className="text-sm text-neutral-dark">
                This project is archived. Unarchive to let members post again.
              </p>
              <form action={unarchiveProject}>
                <input type="hidden" name="id" value={project.id} />
                <button
                  type="submit"
                  className="rounded-md border border-brand-border px-4 py-1.5 text-sm text-navy hover:bg-muted"
                >
                  Unarchive project
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm text-neutral-dark">
                Archiving makes the thread read-only. Messages remain visible. You can
                unarchive at any time.
              </p>
              <form action={archiveProject}>
                <input type="hidden" name="id" value={project.id} />
                <button
                  type="submit"
                  className="rounded-md bg-danger-bg text-danger-text border border-danger-text/20 px-4 py-1.5 text-sm font-medium hover:opacity-90 transition"
                >
                  Archive project
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
