import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { AdminNav } from "@/components/admin-nav";
import { SubmitButton } from "@/components/button";
import { relativeTime } from "@/lib/format";
import { dismissFlag, acknowledgeFlag, resolveReport } from "../actions";

export default async function AdminFlagsPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const filter = (typeof sp.filter === "string" ? sp.filter : "pending") as
    | "pending"
    | "all"
    | "dismissed"
    | "acknowledged";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("users")
    .select("role, full_name, email, school_id, organization, deactivated_at")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");
  if (profile.deactivated_at) {
    await supabase.auth.signOut();
    redirect("/login?error=Your+account+has+been+deactivated.");
  }
  if (profile.role !== "school_admin" && profile.role !== "district_admin") {
    redirect("/");
  }
  const isDistrict = profile.role === "district_admin";
  const admin = createAdminClient();

  const flagsQ = admin
    .from("content_flags")
    .select(
      "id, message_id, flag_type, matched_text, was_blocked, status, created_at, project:projects!project_id(id, name, school_id), sender:users!sender_id(full_name, role)"
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter !== "all") flagsQ.eq("status", filter);

  const { data: flags } = await flagsQ;

  const reportsQ = admin
    .from("message_reports")
    .select(
      "id, reason, status, created_at, project:projects!project_id(id, name, school_id), reporter:users!reporter_id(full_name, role), message:messages!message_id(id, body, sender:users!sender_id(full_name, role))"
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter !== "all") reportsQ.eq("status", filter);

  const { data: reports } = await reportsQ;

  const scopedFlags = (flags ?? []).filter((f) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = f.project as any;
    return isDistrict || p?.school_id === profile.school_id;
  });
  const scopedReports = (reports ?? []).filter((r) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = r.project as any;
    return isDistrict || p?.school_id === profile.school_id;
  });

  return (
    <main className="min-h-screen bg-[#F2F5FA] text-foreground">
      <AppHeader profile={profile} canInvite canCreateProject />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 grid gap-6 lg:gap-8 lg:grid-cols-[200px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <AdminNav active="/admin/flags" />
        </aside>

        <div className="space-y-6 min-w-0">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl text-navy">
              Flagged content
            </h1>
            <p className="text-sm text-neutral-dark mt-1">
              Messages flagged by the filter, plus user reports.
            </p>
          </div>

          <div className="flex gap-1 text-xs flex-wrap">
            {(["pending", "acknowledged", "dismissed", "all"] as const).map((f) => (
              <Link
                key={f}
                href={`/admin/flags?filter=${f}`}
                className={`px-3 py-1.5 rounded-md transition-colors duration-100 ${
                  filter === f
                    ? "bg-navy text-white"
                    : "text-neutral-dark hover:bg-neutral-100"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Link>
            ))}
          </div>

          <section className="bg-surface rounded-xl border border-brand-border p-4 sm:p-6 space-y-4">
            <h2 className="font-serif text-xl text-navy">
              Content filter flags ({scopedFlags.length})
            </h2>
            {scopedFlags.length === 0 ? (
              <p className="text-sm text-neutral-dark italic">
                No {filter !== "all" ? filter : ""} flags.
              </p>
            ) : (
              <ul className="space-y-4">
                {scopedFlags.map((f) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const p = f.project as any;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const s = f.sender as any;
                  const contextUrl = f.message_id
                    ? `/projects/${p?.id}?highlight=${f.message_id}`
                    : `/projects/${p?.id}`;
                  return (
                    <li
                      key={f.id}
                      className="py-3 border-b border-brand-border/50 last:border-b-0 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap text-sm">
                            <span className="font-medium text-navy">
                              {s?.full_name ?? "Unknown"}
                            </span>
                            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700">
                              {s?.role?.replace("_", " ")}
                            </span>
                            <span className="text-neutral-dark">—</span>
                            <span className="text-neutral-dark">
                              {f.flag_type.replace("_", " ")}
                            </span>
                            {f.was_blocked && (
                              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-danger/15 text-danger">
                                Blocked
                              </span>
                            )}
                            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-dark">
                              {f.status}
                            </span>
                          </div>
                          <div className="text-xs text-neutral-dark">
                            in{" "}
                            <Link
                              href={contextUrl}
                              className="hover:text-navy underline"
                            >
                              {p?.name}
                            </Link>{" "}
                            · {relativeTime(f.created_at)}
                            {f.message_id && (
                              <>
                                {" · "}
                                <Link
                                  href={contextUrl}
                                  className="hover:text-navy underline"
                                >
                                  Review in context →
                                </Link>
                              </>
                            )}
                          </div>
                        </div>
                        {f.status === "pending" && (
                          <div className="flex gap-2 flex-shrink-0">
                            <form action={dismissFlag}>
                              <input type="hidden" name="id" value={f.id} />
                              <SubmitButton
                                size="sm"
                                variant="secondary"
                                loadingText="…"
                              >
                                Dismiss
                              </SubmitButton>
                            </form>
                            <form action={acknowledgeFlag}>
                              <input type="hidden" name="id" value={f.id} />
                              <SubmitButton
                                size="sm"
                                variant="success"
                                loadingText="…"
                              >
                                Acknowledge
                              </SubmitButton>
                            </form>
                          </div>
                        )}
                      </div>
                      <div className="rounded-md bg-[#F2F5FA] px-3 py-2 text-xs text-neutral-dark font-mono break-all">
                        {f.matched_text}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="bg-surface rounded-xl border border-brand-border p-4 sm:p-6 space-y-4">
            <h2 className="font-serif text-xl text-navy">
              User reports ({scopedReports.length})
            </h2>
            {scopedReports.length === 0 ? (
              <p className="text-sm text-neutral-dark italic">
                No {filter !== "all" ? filter : ""} reports.
              </p>
            ) : (
              <ul className="space-y-4">
                {scopedReports.map((r) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const p = r.project as any;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const reporter = r.reporter as any;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const msg = r.message as any;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const msgSender = msg?.sender as any;
                  const contextUrl = msg?.id
                    ? `/projects/${p?.id}?highlight=${msg.id}`
                    : `/projects/${p?.id}`;
                  return (
                    <li
                      key={r.id}
                      className="py-3 border-b border-brand-border/50 last:border-b-0 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap text-sm">
                            <span className="font-medium text-navy">
                              {reporter?.full_name ?? "Unknown"}
                            </span>
                            <span className="text-neutral-dark">
                              reported a message from
                            </span>
                            <span className="font-medium text-navy">
                              {msgSender?.full_name ?? "Unknown"}
                            </span>
                            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-dark">
                              {r.status}
                            </span>
                          </div>
                          <div className="text-xs text-neutral-dark">
                            in{" "}
                            <Link
                              href={contextUrl}
                              className="hover:text-navy underline"
                            >
                              {p?.name}
                            </Link>{" "}
                            · {relativeTime(r.created_at)}
                            {msg?.id && (
                              <>
                                {" · "}
                                <Link
                                  href={contextUrl}
                                  className="hover:text-navy underline"
                                >
                                  Review in context →
                                </Link>
                              </>
                            )}
                          </div>
                        </div>
                        {r.status === "pending" && (
                          <div className="flex gap-2 flex-shrink-0">
                            <form action={resolveReport}>
                              <input type="hidden" name="id" value={r.id} />
                              <input
                                type="hidden"
                                name="action"
                                value="dismiss"
                              />
                              <SubmitButton
                                size="sm"
                                variant="secondary"
                                loadingText="…"
                              >
                                Dismiss
                              </SubmitButton>
                            </form>
                            <form action={resolveReport}>
                              <input type="hidden" name="id" value={r.id} />
                              <input
                                type="hidden"
                                name="action"
                                value="acknowledge"
                              />
                              <SubmitButton
                                size="sm"
                                variant="success"
                                loadingText="…"
                              >
                                Acknowledge
                              </SubmitButton>
                            </form>
                          </div>
                        )}
                      </div>
                      {r.reason && (
                        <div className="text-xs text-neutral-dark">
                          <span className="italic">Reason:</span> {r.reason}
                        </div>
                      )}
                      {msg?.body && (
                        <blockquote className="rounded-md bg-[#F2F5FA] px-3 py-2 text-xs text-neutral-dark border-l-2 border-brand-border">
                          {msg.body}
                        </blockquote>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
