import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { AdminNav } from "@/components/admin-nav";
import { RoleSelect } from "@/components/role-select";
import { relativeTime } from "@/lib/format";
import {
  deactivateUser,
  reactivateUser,
  changeUserRole,
} from "../actions";

const ROLES = [
  "student",
  "partner",
  "teacher",
  "school_admin",
  "district_admin",
];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const roleFilter = typeof sp.role === "string" ? sp.role : "all";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, full_name, email, school_id, organization")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  if (profile.role !== "school_admin" && profile.role !== "district_admin") {
    redirect("/");
  }
  const isDistrict = profile.role === "district_admin";

  const admin = createAdminClient();
  const query = admin
    .from("users")
    .select("id, full_name, email, role, organization, school_id, school:schools!school_id(name), created_at, deactivated_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (!isDistrict) query.eq("school_id", profile.school_id);
  if (roleFilter !== "all" && ROLES.includes(roleFilter)) {
    query.eq("role", roleFilter);
  }
  if (q) query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);

  const { data: users } = await query;

  const error = typeof sp.error === "string" ? sp.error : null;
  const success = typeof sp.success === "string" ? sp.success : null;

  return (
    <main className="min-h-screen bg-[#F2F5FA] text-foreground">
      <AppHeader profile={profile} canInvite canCreateProject />

      <div className="mx-auto max-w-6xl px-6 py-8 grid gap-8 lg:grid-cols-[200px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <AdminNav active="/admin/users" />
        </aside>

        <div className="space-y-6 min-w-0">
          <div>
            <h1 className="font-serif text-3xl text-navy">Users</h1>
            <p className="text-sm text-neutral-dark mt-1">
              {users?.length ?? 0} shown ·{" "}
              {isDistrict ? "all schools" : "your school"}
            </p>
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

          <form className="flex gap-2 flex-wrap items-center">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search name or email…"
              className="rounded-md border border-brand-border px-3 py-1.5 text-sm bg-white flex-1 min-w-[200px]"
            />
            <select
              name="role"
              defaultValue={roleFilter}
              className="rounded-md border border-brand-border px-3 py-1.5 text-sm bg-white"
            >
              <option value="all">All roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace("_", " ")}
                </option>
              ))}
            </select>
            <button className="px-3 py-1.5 text-sm rounded-md bg-navy text-white">
              Filter
            </button>
            {(q || roleFilter !== "all") && (
              <Link
                href="/admin/users"
                className="text-xs text-neutral-dark hover:text-navy"
              >
                Clear
              </Link>
            )}
          </form>

          <div className="bg-surface rounded-xl border border-brand-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#F2F5FA] text-xs text-neutral-dark uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Role</th>
                  {isDistrict && (
                    <th className="text-left px-4 py-3 font-medium">School</th>
                  )}
                  <th className="text-left px-4 py-3 font-medium">Joined</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!users || users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isDistrict ? 6 : 5}
                      className="px-4 py-8 text-center text-neutral-dark italic"
                    >
                      No users match.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const isSelf = u.id === profile.id;
                    const deactivated = !!u.deactivated_at;
                    return (
                      <tr
                        key={u.id}
                        className={`border-t border-brand-border/50 hover:bg-neutral-50 ${deactivated ? "opacity-60" : ""}`}
                      >
                        <td className="px-4 py-3 text-navy font-medium">
                          {u.full_name}
                          {u.organization && (
                            <div className="text-xs text-neutral-dark font-normal">
                              {u.organization}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-neutral-dark">
                          {u.email}
                        </td>
                        <td className="px-4 py-3">
                          {isDistrict && !isSelf ? (
                            <RoleSelect
                              userId={u.id}
                              currentRole={u.role}
                              roles={ROLES}
                              action={changeUserRole}
                            />
                          ) : (
                            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700">
                              {u.role.replace("_", " ")}
                            </span>
                          )}
                        </td>
                        {isDistrict && (
                          <td className="px-4 py-3 text-neutral-dark text-xs">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {(u.school as any)?.name ?? "—"}
                          </td>
                        )}
                        <td className="px-4 py-3 text-neutral-dark text-xs">
                          {relativeTime(u.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isDistrict && !isSelf && (
                            <form
                              action={deactivated ? reactivateUser : deactivateUser}
                              className="inline"
                            >
                              <input type="hidden" name="id" value={u.id} />
                              <button
                                className={`text-xs ${deactivated ? "text-success hover:underline" : "text-danger hover:underline"}`}
                              >
                                {deactivated ? "Reactivate" : "Deactivate"}
                              </button>
                            </form>
                          )}
                          {isSelf && (
                            <span className="text-xs text-neutral-dark italic">
                              you
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!isDistrict && (
            <p className="text-xs text-neutral-dark italic">
              Only district admins can change roles or deactivate users.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
