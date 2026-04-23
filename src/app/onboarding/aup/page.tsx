import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { acceptAup } from "./actions";

export default async function AupPage({
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
    .select("full_name, role, coc_accepted_at")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  if (profile.coc_accepted_at) redirect("/");
  if (profile.role !== "student") redirect("/");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-xl mx-auto px-6 py-10 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-medium text-navy">Acceptable use agreement</h1>
          <p className="text-sm text-neutral-dark">
            Quick agreement before you get started. This platform is school-managed — everything you
            send here is seen by your teacher and district administrators.
          </p>
        </div>

        <form action={acceptAup} className="space-y-6">
          <div className="border border-brand-border rounded-lg p-4 bg-surface space-y-3 text-sm">
            <p className="text-neutral-dark">By continuing, I understand and agree that:</p>
            <ul className="list-disc list-inside space-y-1 text-navy">
              <li>My messages are visible to my teacher and district administrators.</li>
              <li>I will keep all communication with partners on this platform — no texting, social media, or outside email.</li>
              <li>I will communicate respectfully and professionally, like I would in class.</li>
              <li>I will not share personal contact info (phone, social handles, personal email).</li>
              <li>If something feels wrong, I&apos;ll tell my teacher or use the Report button.</li>
            </ul>
          </div>

          <label className="flex items-start gap-2 text-sm text-navy">
            <input
              type="checkbox"
              name="agree"
              required
              className="mt-1 rounded border-brand-border"
            />
            <span>I have read and agree to this acceptable use agreement.</span>
          </label>

          <div className="space-y-1">
            <label htmlFor="typed_name" className="text-sm font-medium text-navy">
              Type your full name to confirm
            </label>
            <input
              id="typed_name"
              name="typed_name"
              type="text"
              required
              placeholder={profile.full_name}
              className="w-full rounded-md border border-brand-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-neutral-dark">
              Must match: <strong>{profile.full_name}</strong>
            </p>
          </div>

          {sp.error && (
            <p className="text-sm bg-danger-bg text-danger-text p-2 rounded">{sp.error}</p>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-navy text-surface py-2.5 text-sm font-medium hover:bg-navy-soft transition"
          >
            I agree — continue
          </button>
        </form>
      </div>
    </main>
  );
}
