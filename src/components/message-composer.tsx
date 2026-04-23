"use client";

import { useState, useTransition } from "react";
import { sendMessage } from "@/app/projects/[id]/actions";
import { UploadButton, type UploadedAttachment } from "./upload-button";

export function MessageComposer({ projectId }: { projectId: string }) {
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [attachment, setAttachment] = useState<UploadedAttachment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [block, setBlock] = useState<{ type: string; match: string } | null>(null);
  const [softWarn, setSoftWarn] = useState<{ type: string; match: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  function submit(confirmed: boolean) {
    setError(null);
    setBlock(null);
    if (!confirmed) setSoftWarn(null);
    const fd = new FormData();
    fd.set("project_id", projectId);
    fd.set("body", body);
    if (link) fd.set("link_url", link);
    if (confirmed) fd.set("confirmed_send", "true");
    if (attachment) {
      fd.set("attachment_path", attachment.path);
      fd.set("attachment_name", attachment.name);
      fd.set("attachment_size", String(attachment.size));
      fd.set("attachment_mime", attachment.mime);
    }

    startTransition(async () => {
      const res = await sendMessage(fd);
      if (!res) return;
      if ("ok" in res) {
        setBody("");
        setLink("");
        setShowLink(false);
        setAttachment(null);
        setSoftWarn(null);
        return;
      }
      if ("needsConfirm" in res) {
        setSoftWarn(res.softWarn);
        return;
      }
      if (res.blocked) {
        setBlock(res.blocked);
        return;
      }
      setError(res.error);
    });
  }

  const canSend = (body.trim().length > 0 || !!attachment) && !isPending;

  return (
    <>
      <div className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message…"
          className="w-full min-h-[88px] rounded-md border border-brand-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-navy resize-y"
          disabled={isPending}
        />
        {showLink && (
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-md border border-brand-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-navy"
          />
        )}
        {attachment && (
          <div className="flex items-center justify-between gap-2 rounded-md bg-[#F2F5FA] border border-brand-border px-3 py-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span>📎</span>
              <span className="truncate text-navy">{attachment.name}</span>
              <span className="text-neutral-dark flex-shrink-0">
                {formatBytes(attachment.size)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="text-neutral-dark hover:text-danger flex-shrink-0"
            >
              Remove
            </button>
          </div>
        )}
        {error && (
          <div className="text-sm text-danger rounded-md bg-danger/10 px-3 py-2">
            {error}
          </div>
        )}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setShowLink((v) => !v)}
              className="text-xs text-neutral-dark hover:text-navy"
            >
              {showLink ? "Remove link" : "+ Add link"}
            </button>
            {!attachment && (
              <UploadButton
                projectId={projectId}
                onUploaded={setAttachment}
                disabled={isPending}
              />
            )}
          </div>
          <button
            onClick={() => submit(false)}
            disabled={!canSend}
            className="px-4 py-2 rounded-md bg-navy text-white text-sm disabled:opacity-50"
          >
            {isPending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>

      {block && (
        <BlockDialog
          flagType={block.type}
          match={block.match}
          onClose={() => setBlock(null)}
        />
      )}

      {softWarn && (
        <SoftWarnDialog
          flagType={softWarn.type}
          match={softWarn.match}
          isPending={isPending}
          onCancel={() => setSoftWarn(null)}
          onConfirm={() => submit(true)}
        />
      )}
    </>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function BlockDialog({
  flagType,
  match,
  onClose,
}: {
  flagType: string;
  match: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 flex items-center justify-center rounded-full bg-danger/10 text-danger flex-shrink-0">
            !
          </div>
          <div className="space-y-2">
            <h2 className="font-serif text-xl text-navy">Message blocked</h2>
            <p className="text-sm text-neutral-dark">
              We detected a <strong>{flagType}</strong> in your message.
              Personal contact info and social handles aren&apos;t allowed in
              Handshake — it&apos;s a school-monitored space.
            </p>
            <div className="rounded-md bg-[#F2F5FA] px-3 py-2 text-xs text-neutral-dark font-mono break-all">
              {match}
            </div>
            <p className="text-xs text-neutral-dark">
              Edit your message to remove this and try again. If you need to
              share contact info, talk to your teacher.
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-navy text-white text-sm"
          >
            OK, I&apos;ll edit
          </button>
        </div>
      </div>
    </div>
  );
}

function SoftWarnDialog({
  flagType,
  match,
  isPending,
  onCancel,
  onConfirm,
}: {
  flagType: string;
  match: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 flex items-center justify-center rounded-full bg-warning/15 text-warning flex-shrink-0">
            ?
          </div>
          <div className="space-y-2">
            <h2 className="font-serif text-xl text-navy">
              Send this {flagType}?
            </h2>
            <p className="text-sm text-neutral-dark">
              Your message contains an external link. Teachers can see it and
              review it if needed.
            </p>
            <div className="rounded-md bg-[#F2F5FA] px-3 py-2 text-xs text-neutral-dark font-mono break-all">
              {match}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 rounded-md border border-brand-border text-sm text-neutral-dark hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 rounded-md bg-navy text-white text-sm disabled:opacity-50"
          >
            {isPending ? "Sending…" : "Send anyway"}
          </button>
        </div>
      </div>
    </div>
  );
}
