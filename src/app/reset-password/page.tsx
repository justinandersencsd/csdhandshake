import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { updatePassword } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Must be signed in via the callback code exchange to reset password
  if (!user) {
    redirect("/forgot-password?error=Please+request+a+new+reset+link");
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-medium text-navy">Set a new password</h1>
          <p className="text-sm text-neutral-dark">
            Signed in as {user.email}
          </p>
        </div>

        <form action={updatePassword} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium text-navy">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-md border border-brand-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-neutral-dark">At least 8 characters.</p>
          </div>

          <div className="space-y-1">
            <label htmlFor="confirm" className="text-sm font-medium text-navy">
              Confirm password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-md border border-brand-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {sp.error && (
            <p className="text-sm bg-danger-bg text-danger-text p-2 rounded">{sp.error}</p>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-navy text-surface py-2 text-sm font-medium hover:bg-navy-soft transition"
          >
            Update password
          </button>
        </form>
      </div>
    </main>
  );
}
