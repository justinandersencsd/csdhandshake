import { createAdminClient } from "@/lib/supabase/admin";
import { acceptInvitation } from "./actions";

export default async function InviteAcceptPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;

  const admin = createAdminClient();
  const { data: invitation } = await admin
    .from("invitations")
    .select("id, email, full_name, role, organization, school_id, expires_at, accepted_at, invited_by")
    .eq("token", token)
    .maybeSingle();

  if (!invitation) {
    return <InvalidInvitation message="This invitation link is invalid or has been removed." />;
  }

  if (invitation.accepted_at) {
    return (
      <InvalidInvitation message="This invitation has already been used. If you need a new one, ask whoever invited you to send another." />
    );
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return (
      <InvalidInvitation message="This invitation has expired. Ask whoever invited you to send a new one." />
    );
  }

  const { data: inviter } = await admin
    .from("users")
    .select("full_name")
    .eq("id", invitation.invited_by)
    .maybeSingle();

  const { data: school } = await admin
    .from("schools")
    .select("name")
    .eq("id", invitation.school_id)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-medium text-navy">Welcome to CSD Handshake</h1>
          <p className="text-sm text-neutral-dark">
            Set your password to accept the invitation
          </p>
        </div>

        <div className="border border-brand-border rounded-lg p-4 bg-surface text-sm space-y-1">
          <div><span className="text-neutral-dark">Name: </span><span className="text-navy">{invitation.full_name}</span></div>
          <div><span className="text-neutral-dark">Email: </span><span className="text-navy">{invitation.email}</span></div>
          <div><span className="text-neutral-dark">Role: </span><span className="text-navy">{invitation.role.replace("_", " ")}</span></div>
          {inviter && <div><span className="text-neutral-dark">Invited by: </span><span className="text-navy">{inviter.full_name}</span></div>}
          {school && <div><span className="text-neutral-dark">School: </span><span className="text-navy">{school.name}</span></div>}
        </div>

        <form action={acceptInvitation} className="space-y-4">
          <input type="hidden" name="token" value={token} />

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium text-navy">
              Create a password
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
            Accept & create account
          </button>
        </form>
      </div>
    </main>
  );
}

function InvalidInvitation({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
      <div className="w-full max-w-md text-center space-y-4">
        <h1 className="text-2xl font-medium text-navy">Invitation unavailable</h1>
        <p className="text-sm text-neutral-dark">{message}</p>
        <a
          href="/login"
          className="inline-block text-sm text-navy hover:underline"
        >
          Go to sign in →
        </a>
      </div>
    </main>
  );
}
