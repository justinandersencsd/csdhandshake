import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createProject } from "./actions";
import Link from "next/link";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
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

  if (!profile || !["teacher", "school_admin", "district_admin"].includes(profile.role)) {
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
          <h1 className="text-2xl font-medium text-navy">New project</h1>
          <p className="text-sm text-neutral-dark mt-1">
            You&apos;ll be added as the owner. You can invite students and partners after
            creating the project.
          </p>
        </div>

        {sp.error && (
          <div className="bg-danger-bg text-danger-text p-3 rounded text-sm">{sp.error}</div>
        )}

        <form
          action={createProject}
          className="space-y-4 border border-brand-border rounded-lg p-6 bg-surface"
        >
          <div className="space-y-1">
            <label htmlFor="name" className="text-sm font-medium text-navy">
              Project name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="e.g. Spring 2026 — Marketing Mentorship"
              className="w-full rounded-md border border-brand-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="description" className="text-sm font-medium text-navy">
              Description <span className="text-neutral-dark font-normal">(optional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="What are students working on?"
              className="w-full rounded-md border border-brand-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="partner_organization" className="text-sm font-medium text-navy">
              Partner organization{" "}
              <span className="text-neutral-dark font-normal">(optional)</span>
            </label>
            <input
              id="partner_organization"
              name="partner_organization"
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
              defaultValue={profile.school_id ?? ""}
              className="w-full rounded-md border border-brand-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
            Create project
          </button>
        </form>
      </div>
    </main>
  );
}
