import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { inviteUser } from "./actions";
import Link from "next/link";

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
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

  if (
    !profile ||
    !["teacher", "school_admin", "district_admin"].includes(profile.role)
  ) {
    redirect("/");
  }

  const { data: schools } = await supabase.from("schools").select("id, name");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-brand-border bg-surface">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-medium text-navy">
            CSD Handshake
          </Link>
          <Link href="/" className="text-sm text-neutral-dark hover:text-navy">
            ← Back
          </Link>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-medium text-navy">Invite someone</h1>
          <p className="text-sm text-neutral-dark mt-1">
            They&apos;ll receive an email with a link to set up their account.
          </p>
        </div>

        {params.success && (
          <div className="bg-success-bg text-success-text p-3 rounded text-sm">
            ✓ Invitation sent to {params.success}
          </div>
        )}

        {params.error && (
          <div className="bg-danger-bg text-danger-text p-3 rounded text-sm">
            {params.error}
          </div>
        )}

        <form action={inviteUser} className="space-y-4 border border-brand-border rounded-lg p-6 bg-surface">
          <div className="space-y-1">
            <label htmlFor="full_name" className="text-sm font-medium text-navy">
              Full name
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              className="w-full rounded-md border border-brand-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium text-navy">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-brand-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="role" className="text-sm font-medium text-navy">
              Role
            </label>
            <select
              id="role"
              name="role"
              required
              className="w-full rounded-md border border-brand-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="student">Student</option>
              <option value="partner">Partner (external)</option>
              {profile.role === "district_admin" && (
                <>
                  <option value="teacher">Teacher</option>
                  <option value="school_admin">School Admin</option>
                  <option value="district_admin">District Admin</option>
                </>
              )}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="organization" className="text-sm font-medium text-navy">
              Organization <span className="text-neutral-dark font-normal">(partners only)</span>
            </label>
            <input
              id="organization"
              name="organization"
              type="text"
              placeholder="e.g. Acme Corp"
              className="w-full rounded-md border border-brand-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="school_id" className="text-sm font-medium text-navy">
              School
            </label>
            <select
              id="school_id"
              name="school_id"
              required
              className="w-full rounded-md border border-brand-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              defaultValue={profile.school_id ?? ""}
            >
              <option value="">Select a school</option>
              {schools?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-navy text-surface py-2 text-sm font-medium hover:bg-navy-soft transition"
          >
            Send invitation
          </button>
        </form>
      </div>
    </main>
  );
}
