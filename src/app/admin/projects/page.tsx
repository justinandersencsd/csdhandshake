import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { AdminNav } from "@/components/admin-nav";
import { relativeTime } from "@/lib/format";

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const statusFilter = (typeof sp.status === "string" ? sp.status : "all") as
    | "all"
    | "active"
    | "archived";

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

  if (profile.role !== "school_admin" && profile.role !== "district_admin") {
    redirect("/");
  }
  const isDistrict = profile.role === "district_admin";

  const admin = createAdminClient();
  const q = admin
    .from("projects")
    .select(
      "id, name, status, partner_organization, created_at, created_by, school_id, school:schools!school_id(name), owner:users!created_by(full_name)"
    )
    .order("updated_at", { ascending: false });

  if (!isDistrict) q.eq("school_id", profile.school_id);
  if (statusFilter !== "all") q.eq("status", statusFilter);

  const { data: projects } = await q;

  // Get member counts per project
  const ids = (projects ?? []).map((p) => p.id);
  let memberCounts: Map<string, number> = new Map();
  if (ids.length) {
    const { data: mems } = await admin
      .from("project_members")
      .select("project_id")
      .in("project_id", ids)
      .is("left_at", null);
    for (const m of mems ?? []) {
      memberCounts.set(m.project_id, (memberCounts.get(m.project_id) ?? 0) + 1);
    }
  }

  return (
    <main className="min-h-screen bg-[#F2F5FA] text-foreground">
      <AppHeader profile={profile} canInvite canCreateProject />

      <div className="mx-auto max-w-6xl px-6 py-8 grid gap-8 lg:grid-cols-[200px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <AdminNav active="/admin/projects" />
        </aside>

        <div className="space-y-6 min-w-0">
          <div>
            <h1 className="font-serif text-3xl text-navy">Projects</h1>
            <p className="text-sm text-neutral-dark mt-1">
              {projects?.length ?? 0} total ·{" "}
              {isDistrict ? "all schools" : "your school"}
            </p>
          </div>

          <div className="flex gap-1 text-xs">
            {(["all", "active", "archived"] as const).map((f) => (
              <Link
                key={f}
                href={`/admin/projects?status=${f}`}
                className={`px-3 py-1.5 rounded-md transition ${
                  statusFilter === f
                    ? "bg-navy text-white"
                    : "text-neutral-dark hover:bg-neutral-100"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Link>
            ))}
          </div>

          <div className="bg-surface rounded-xl border border-brand-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#F2F5FA] text-xs text-neutral-dark uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Project</th>
                  {isDistrict && (
                    <th className="text-left px-4 py-3 font-medium">School</th>
                  )}
                  <th className="text-left px-4 py-3 font-medium">Owner</th>
                  <th className="text-left px-4 py-3 font-medium">Partner</th>
                  <th className="text-left px-4 py-3 font-medium">Members</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {!projects || projects.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isDistrict ? 7 : 6}
                      className="px-4 py-8 text-center text-neutral-dark italic"
                    >
                      No projects.
                    </td>
                  </tr>
                ) : (
                  projects.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t border-brand-border/50 hover:bg-neutral-50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/projects/${p.id}`}
                          className="text-navy hover:underline font-medium"
                        >
                          {p.name}
                        </Link>
                      </td>
                      {isDistrict && (
                        <td className="px-4 py-3 text-neutral-dark text-xs">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {(p.school as any)?.name}
                        </td>
                      )}
                      <td className="px-4 py-3 text-neutral-dark">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(p.owner as any)?.full_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-neutral-dark">
                        {p.partner_organization ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-neutral-dark">
                        {memberCounts.get(p.id) ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            p.status === "active"
                              ? "bg-success/15 text-success"
                              : "bg-neutral-200 text-neutral-700"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-dark text-xs">
                        {relativeTime(p.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
