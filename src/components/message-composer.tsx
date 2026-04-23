"use client";

import { useState, useRef } from "react";
import { sendMessage } from "@/app/projects/[id]/actions";

export function MessageComposer({
  projectId,
  disabled,
}: {
  projectId: string;
  disabled?: boolean;
}) {
  const [showLink, setShowLink] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const result = await sendMessage(projectId, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        formRef.current?.reset();
        setShowLink(false);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  if (disabled) {
    return (
      <div className="border-t border-brand-border p-4 bg-muted text-sm text-neutral-dark text-center">
        This project is archived. Messages are read-only.
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="border-t border-brand-border p-3 bg-surface space-y-2"
    >
      <textarea
        name="body"
        required
        rows={2}
        placeholder="Write a message..."
        className="w-full rounded-md border border-brand-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
      />

      {showLink && (
        <div className="space-y-2 border border-brand-border rounded-md p-3 bg-muted">
          <input
            type="url"
            name="attachment_url"
            placeholder="https://docs.google.com/..."
            className="w-full rounded-md border border-brand-border bg-surface px-3 py-1.5 text-sm"
          />
          <input
            type="text"
            name="attachment_label"
            placeholder="Label (e.g. Project brief)"
            className="w-full rounded-md border border-brand-border bg-surface px-3 py-1.5 text-sm"
          />
        </div>
      )}

      {error && (
        <p className="text-sm bg-danger-bg text-danger-text p-2 rounded">{error}</p>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowLink(!showLink)}
            className="text-xs text-neutral-dark hover:text-navy px-2 py-1 rounded border border-brand-border"
          >
            {showLink ? "− Remove link" : "+ Link"}
          </button>
          <button
            type="button"
            disabled
            className="text-xs text-neutral-dark opacity-50 px-2 py-1 rounded border border-brand-border cursor-not-allowed"
          >
            + File (coming soon)
          </button>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-navy text-surface px-4 py-1.5 text-sm font-medium hover:bg-navy-soft transition disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}
