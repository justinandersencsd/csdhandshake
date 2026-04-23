import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { AdminNav } from "@/components/admin-nav";
import { relativeTime } from "@/lib/format";

const EVENT_CATEGORIES = {
  All: null,
  Messages: ["message.sent", "message.blocked", "message.flagged_soft", "message.approved", "message.reported"],
  Projects: ["project.created", "project.settings_changed", "project.safety_changed", "project.archived", "project.unarchived", "project.member_added", "project.member_removed"],
  Users: ["user.invited", "user.accepted_invite", "user.deactivated", "user.reactivated", "user.role_changed"],
  Moderation: ["flag.dismissed", "flag.escalated", "report.dismissed", "report.escalated"],
} as const;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const categoryKey = (typeof sp.category === "string" ? sp.category : "All") as keyof typeof EVENT_CATEGORIES;
  const category = EVENT_CATEGORIES[categoryKey] ?? null;
  const userQuery = typeof sp.user === "string" ? sp.user.trim() : "";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

  const admin = createAdminClient();
  const q = admin
    .from("audit_events")
    .select(
      "id, event_type, target_type, target_id, metadata, created_at, user:users!user_id(id, full_name, role, school_id)"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (category) q.in("event_type", [...category]);

  const { data: events } = await q;

  // Filter by school scope for school admin
  const isDistrict = profile.role === "district_admin";
  const filtered = (events ?? []).filter((e) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = e.user as any;
    if (!isDistrict && u?.school_id !== profile.school_id) return false;
    if (userQuery) {
      const nameMatch = u?.full_name
        ?.toLowerCase()
        .includes(userQuery.toLowerCase());
      if (!nameMatch) return false;
    }
    return true;
  });

  return (
    <main className="min-h-screen bg-[#F2F5FA] text-foreground">
      <AppHeader profile={profile} canInvite canCreateProject />

      <div className="mx-auto max-w-6xl px-6 py-8 grid gap-8 lg:grid-cols-[200px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <AdminNav active="/admin/audit" />
        </aside>

        <div className="space-y-6 min-w-0">
          <div>
            <h1 className="font-serif text-3xl text-navy">Audit log</h1>
            <p className="text-sm text-neutral-dark mt-1">
              Last 200 events. {isDistrict ? "District-wide." : "Your school only."}
            </p>
          </div>

          <div className="flex gap-1 text-xs flex-wrap">
            {(Object.keys(EVENT_CATEGORIES) as Array<keyof typeof EVENT_CATEGORIES>).map((k) => (
              <Link
                key={k}
                href={`/admin/audit?category=${k}${userQuery ? `&user=${encodeURIComponent(userQuery)}` : ""}`}
                className={`px-3 py-1.5 rounded-md transition ${
                  categoryKey === k
                    ? "bg-navy text-white"
                    : "text-neutral-dark hover:bg-neutral-100"
                }`}
              >
                {k}
              </Link>
            ))}
          </div>

          <form className="flex gap-2">
            <input type="hidden" name="category" value={categoryKey} />
            <input
              type="text"
              name="user"
              defaultValue={userQuery}
              placeholder="Filter by user name…"
              className="flex-1 rounded-md border border-brand-border px-3 py-1.5 text-sm bg-white"
            />
            <button className="px-3 py-1.5 text-sm rounded-md bg-navy text-white">
              Filter
            </button>
            {userQuery && (
              <Link
                href={`/admin/audit?category=${categoryKey}`}
                className="text-xs text-neutral-dark hover:text-navy self-center"
              >
                Clear
              </Link>
            )}
          </form>

          <div className="bg-surface rounded-xl border border-brand-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#F2F5FA] text-xs text-neutral-dark uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">When</th>
                  <th className="text-left px-4 py-3 font-medium">Who</th>
                  <th className="text-left px-4 py-3 font-medium">Event</th>
                  <th className="text-left px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-neutral-dark italic"
                    >
                      No events match.
                    </td>
                  </tr>
                ) : (
                  filtered.map((e) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const u = e.user as any;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const meta = (e.metadata as any) ?? {};
                    return (
                      <tr
                        key={e.id}
                        className="border-t border-brand-border/50 hover:bg-neutral-50 align-top"
                      >
                        <td className="px-4 py-3 text-neutral-dark text-xs whitespace-nowrap">
                          {relativeTime(e.created_at)}
                        </td>
                        <td className="px-4 py-3 text-navy">
                          <div className="font-medium">
                            {u?.full_name ?? "System"}
                          </div>
                          {u?.role && (
                            <div className="text-[10px] uppercase tracking-wider text-neutral-dark">
                              {u.role.replace("_", " ")}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs text-neutral-dark">
                            {e.event_type}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-dark max-w-md">
                          {e.target_type && (
                            <div>
                              <span className="text-neutral-dark/60">target:</span>{" "}
                              {e.target_type}
                              {e.target_id && (
                                <code className="ml-1 text-[10px]">
                                  {e.target_id.slice(0, 8)}
                                </code>
                              )}
                            </div>
                          )}
                          {Object.keys(meta).length > 0 && (
                            <pre className="text-[10px] mt-1 font-mono whitespace-pre-wrap break-all bg-[#F2F5FA] px-2 py-1 rounded max-h-20 overflow-y-auto">
                              {JSON.stringify(meta, null, 2)}
                            </pre>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
