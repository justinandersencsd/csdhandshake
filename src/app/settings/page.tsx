import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { updateNotificationPrefs } from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select(
      "id, full_name, role, email, organization, school_id, notification_prefs"
    )
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  const isTeacher = profile.role === "teacher";
  const isAdmin =
    profile.role === "school_admin" || profile.role === "district_admin";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prefs = (profile.notification_prefs as any) ?? {};
  const emailFrequency = prefs.email_frequency ?? "immediate";
  const inAppEnabled = prefs.in_app_enabled !== false;
  const emailFlagsOnly = prefs.email_flags_only !== false;

  const error = typeof sp.error === "string" ? sp.error : null;
  const success = typeof sp.success === "string" ? sp.success : null;

  return (
    <main className="min-h-screen bg-[#F2F5FA] text-foreground">
      <AppHeader
        profile={profile}
        canInvite={isTeacher || isAdmin}
        canCreateProject={isTeacher || isAdmin}
      />

      <div className="mx-auto max-w-2xl px-6 py-8 space-y-8">
        <div>
          <Link href="/" className="text-xs text-neutral-dark hover:text-navy">
            ← Back
          </Link>
          <h1 className="font-serif text-3xl text-navy mt-2">Settings</h1>
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

        <section className="bg-surface rounded-xl border border-brand-border p-6 space-y-4">
          <div>
            <h2 className="font-serif text-xl text-navy">Your account</h2>
          </div>
          <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
            <dt className="text-neutral-dark">Name</dt>
            <dd className="text-navy">{profile.full_name}</dd>
            <dt className="text-neutral-dark">Email</dt>
            <dd className="text-navy">{profile.email}</dd>
            <dt className="text-neutral-dark">Role</dt>
            <dd className="text-navy">{profile.role.replace("_", " ")}</dd>
            {profile.organization && (
              <>
                <dt className="text-neutral-dark">Organization</dt>
                <dd className="text-navy">{profile.organization}</dd>
              </>
            )}
          </dl>
        </section>

        <section className="bg-surface rounded-xl border border-brand-border p-6 space-y-5">
          <div>
            <h2 className="font-serif text-xl text-navy">Notifications</h2>
            <p className="text-xs text-neutral-dark mt-1">
              Control how Handshake reaches out to you.
            </p>
          </div>

          <form action={updateNotificationPrefs} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm text-navy font-medium">
                Email for new messages
              </label>
              <select
                name="email_frequency"
                defaultValue={emailFrequency}
                className="w-full sm:w-auto rounded-md border border-brand-border px-3 py-2 text-sm bg-white"
              >
                <option value="immediate">Immediately</option>
                <option value="daily">Daily digest only</option>
                <option value="never">Never</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  name="in_app_enabled"
                  defaultChecked={inAppEnabled}
                  className="rounded"
                />
                Show in-app notifications (bell + unread counts)
              </label>
            </div>

            {isAdmin && (
              <div className="pt-3 border-t border-brand-border/50">
                <label className="flex items-center gap-2 text-sm text-navy">
                  <input
                    type="checkbox"
                    name="email_flags_only"
                    defaultChecked={emailFlagsOnly}
                    className="rounded"
                  />
                  Email me when content is flagged for review (admin)
                </label>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button className="px-4 py-2 rounded-md bg-navy text-white text-sm">
                Save preferences
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
