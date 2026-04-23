"use client";

import { useState, useTransition } from "react";
import {
  lookupMemberEmail,
  addExistingMember,
  inviteNewMember,
  type LookupResult,
} from "@/app/projects/[id]/settings/actions";

export function AddMemberForm({ projectId }: { projectId: string }) {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await lookupMemberEmail(projectId, email);
        setResult(res);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  function reset() {
    setResult(null);
    setError(null);
    setEmail("");
  }

  // Initial state: just the email field
  if (!result) {
    return (
      <form onSubmit={handleLookup} className="space-y-3 border-t border-brand-border pt-4">
        <h3 className="text-sm font-medium text-navy">Add a member</h3>
        <p className="text-xs text-neutral-dark">
          Enter an email. If they have an account, they&apos;re added directly. If not,
          we&apos;ll ask for a few details to send them an invitation.
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="person@example.com"
            className="flex-1 rounded-md border border-brand-border bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={isPending || !email.trim()}
            className="rounded-md bg-navy text-surface px-4 py-1.5 text-sm font-medium hover:bg-navy-soft transition disabled:opacity-50"
          >
            {isPending ? "Checking…" : "Continue"}
          </button>
        </div>
        {error && <p className="text-sm bg-danger-bg text-danger-text p-2 rounded">{error}</p>}
      </form>
    );
  }

  // Already a member
  if (result.state === "existing_member") {
    return (
      <div className="space-y-3 border-t border-brand-border pt-4">
        <h3 className="text-sm font-medium text-navy">Add a member</h3>
        <div className="bg-warning-bg text-warning-text p-3 rounded text-sm">
          <strong>{result.fullName}</strong> is already a member of this project.
        </div>
        <button
          type="button"
          onClick={reset}
          className="text-sm text-neutral-dark hover:text-navy"
        >
          ← Try a different email
        </button>
      </div>
    );
  }

  // Existing user — add directly
  if (result.state === "existing_can_add") {
    return (
      <div className="space-y-3 border-t border-brand-border pt-4">
        <h3 className="text-sm font-medium text-navy">Add a member</h3>
        <div className="bg-surface border border-brand-border p-3 rounded text-sm">
          <div className="text-navy font-medium">{result.fullName}</div>
          <div className="text-xs text-neutral-dark">
            {email} · {result.role.replace("_", " ")}
            {result.organization ? ` · ${result.organization}` : ""}
          </div>
        </div>
        <div className="flex gap-2">
          <form action={addExistingMember}>
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="user_id" value={result.userId} />
            <button
              type="submit"
              className="rounded-md bg-navy text-surface px-4 py-1.5 text-sm font-medium hover:bg-navy-soft transition"
            >
              Add to project
            </button>
          </form>
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-brand-border px-4 py-1.5 text-sm text-navy hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Previously removed — same UX as existing (but a clear note)
  if (result.state === "previously_removed") {
    return (
      <div className="space-y-3 border-t border-brand-border pt-4">
        <h3 className="text-sm font-medium text-navy">Add a member</h3>
        <div className="bg-accent text-navy p-3 rounded text-sm">
          <strong>{result.fullName}</strong> was previously removed from this project.
          You can add them back.
        </div>
        <div className="flex gap-2">
          <form action={addExistingMember}>
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="user_id" value={result.userId} />
            <button
              type="submit"
              className="rounded-md bg-navy text-surface px-4 py-1.5 text-sm font-medium hover:bg-navy-soft transition"
            >
              Re-add to project
            </button>
          </form>
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-brand-border px-4 py-1.5 text-sm text-navy hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // New user — show full invite form
  return (
    <form action={inviteNewMember} className="space-y-3 border-t border-brand-border pt-4">
      <h3 className="text-sm font-medium text-navy">Invite new person</h3>
      <p className="text-xs text-neutral-dark">
        We don&apos;t have an account for <strong>{email}</strong>. Fill in their details
        and we&apos;ll send them an invitation.
      </p>

      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="email" value={email} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-navy">Full name</label>
          <input
            name="full_name"
            type="text"
            required
            className="w-full rounded-md border border-brand-border bg-surface px-3 py-1.5 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-navy">Role</label>
          <select
            name="role"
            required
            className="w-full rounded-md border border-brand-border bg-surface px-3 py-1.5 text-sm"
          >
            <option value="student">Student</option>
            <option value="partner">Partner</option>
          </select>
        </div>
        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs font-medium text-navy">
            Organization{" "}
            <span className="text-neutral-dark font-normal">(partners)</span>
          </label>
          <input
            name="organization"
            type="text"
            placeholder="Optional"
            className="w-full rounded-md border border-brand-border bg-surface px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-navy text-surface px-4 py-1.5 text-sm font-medium hover:bg-navy-soft transition"
        >
          Send invitation
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-brand-border px-4 py-1.5 text-sm text-navy hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
