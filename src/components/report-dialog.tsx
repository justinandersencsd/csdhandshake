"use client";

import { useState, useTransition } from "react";
import { reportMessage } from "@/app/projects/[id]/actions";

export function ReportDialog({
  projectId,
  messageId,
  onClose,
}: {
  projectId: string;
  messageId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set("project_id", projectId);
    fd.set("message_id", messageId);
    fd.set("reason", reason);
    startTransition(async () => {
      const res = await reportMessage(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setSubmitted(true);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {submitted ? (
          <>
            <h2 className="font-serif text-xl text-navy">Report sent</h2>
            <p className="text-sm text-neutral-dark">
              A teacher will review this message. Thanks for letting us know.
            </p>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-md bg-navy text-white text-sm"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-serif text-xl text-navy">Report this message</h2>
            <p className="text-sm text-neutral-dark">
              A teacher will review this message. What concerned you? (optional)
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., this seemed inappropriate for school"
              className="w-full min-h-[80px] text-sm rounded-md border border-brand-border px-3 py-2 focus:outline-none focus:ring-1 focus:ring-navy"
              maxLength={500}
            />
            {error && (
              <div className="text-sm text-danger rounded-md bg-danger/10 px-3 py-2">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 rounded-md border border-brand-border text-sm text-neutral-dark hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={isPending}
                className="px-4 py-2 rounded-md bg-navy text-white text-sm disabled:opacity-50"
              >
                {isPending ? "Sending…" : "Send report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
