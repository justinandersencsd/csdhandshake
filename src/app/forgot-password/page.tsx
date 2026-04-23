import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const sp = await searchParams;

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-medium text-navy">Reset your password</h1>
          <p className="text-sm text-neutral-dark">
            We&apos;ll send you a link to set a new password.
          </p>
        </div>

        {sp.sent ? (
          <div className="bg-success-bg text-success-text p-3 rounded text-sm text-center">
            ✓ If an account exists for that email, a reset link is on its way.
          </div>
        ) : (
          <form action={requestPasswordReset} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium text-navy">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
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
              Send reset link
            </button>
          </form>
        )}

        <p className="text-center text-sm">
          <a href="/login" className="text-navy hover:underline">
            ← Back to sign in
          </a>
        </p>
      </div>
    </main>
  );
}
