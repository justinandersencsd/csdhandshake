"use client";

import { useState, useTransition, useEffect } from "react";
import { editMessage, deleteMessage, approveMessage, getAttachmentUrl } from "@/app/projects/[id]/actions";
import { ReportDialog } from "./report-dialog";
import { ReadWatermark, type Reader } from "./read-watermark";
import { relativeTime, initials, isWithin5Min } from "@/lib/format";

type Message = {
  id: string;
  body: string;
  link_url: string | null;
  attachment_path?: string | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
  attachment_mime?: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  sender_id: string;
  pending_review?: boolean;
  sender: {
    full_name: string;
    role: string;
    organization: string | null;
  } | null;
};

const ROLE_COLORS: Record<string, string> = {
  student: "bg-role-student/15 text-role-student",
  partner: "bg-role-partner/15 text-role-partner",
  teacher: "bg-role-teacher/15 text-role-teacher",
  school_admin: "bg-role-admin/15 text-role-admin",
  district_admin: "bg-role-admin/15 text-role-admin",
};

export type GroupPosition = "solo" | "first" | "middle" | "last";

export function MessageItem({
  message,
  currentUserId,
  isAdmin,
  isTeacher,
  projectId,
  groupPosition = "solo",
  watermarkReaders = [],
}: {
  message: Message;
  currentUserId: string;
  isAdmin: boolean;
  isTeacher: boolean;
  projectId: string;
  groupPosition?: GroupPosition;
  watermarkReaders?: Reader[];
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(message.body);
  const [showReport, setShowReport] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isOwn = message.sender_id === currentUserId;
  const isDeleted = !!message.deleted_at;
  const canEdit = isOwn && !isDeleted && isWithin5Min(message.created_at);
  const canDelete = (isOwn || isAdmin) && !isDeleted;
  const canApprove = (isTeacher || isAdmin) && message.pending_review;
  const canReport = !isOwn && !isDeleted;

  const senderName = message.sender?.full_name ?? "Unknown";
  const senderRole = message.sender?.role ?? "student";

  const showHeader = groupPosition === "solo" || groupPosition === "first";
  const showAvatar = showHeader && !isOwn;

  useEffect(() => {
    if (!message.attachment_path || isDeleted) return;
    let cancelled = false;
    getAttachmentUrl(message.attachment_path).then((url) => {
      if (!cancelled) setAttachmentUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [message.attachment_path, isDeleted]);

  function submitEdit() {
    const fd = new FormData();
    fd.set("id", message.id);
    fd.set("project_id", projectId);
    fd.set("body", body);
    startTransition(async () => {
      const res = await editMessage(fd);
      if (res?.error) {
        alert(res.error);
        return;
      }
      setEditing(false);
    });
  }

  function submitDelete() {
    if (!confirm("Delete this message?")) return;
    const fd = new FormData();
    fd.set("id", message.id);
    fd.set("project_id", projectId);
    startTransition(async () => {
      await deleteMessage(fd);
    });
  }

  function submitApprove() {
    const fd = new FormData();
    fd.set("id", message.id);
    fd.set("project_id", projectId);
    startTransition(async () => {
      await approveMessage(fd);
    });
  }

  if (isDeleted) {
    return (
      <div
        id={`msg-${message.id}`}
        className="flex justify-center py-1 text-[11px] text-neutral-dark italic transition-all"
      >
        <div className="text-center">
          Message deleted by{" "}
          {message.deleted_by === message.sender_id ? "sender" : "moderator"} ·{" "}
          {relativeTime(message.deleted_at!)}
          {isAdmin && (
            <div className="mt-1 text-[11px] text-neutral-dark/70 not-italic font-mono line-through opacity-60">
              {message.body}
            </div>
          )}
        </div>
      </div>
    );
  }

  const topSpacing =
    groupPosition === "solo" || groupPosition === "first" ? "mt-4" : "mt-0.5";

  // ===== OWN MESSAGE (right-aligned navy bubble) =====
  if (isOwn) {
    return (
      <div
        id={`msg-${message.id}`}
        className={`flex justify-end group ${topSpacing}`}
      >
        <div className="flex flex-col items-end max-w-[75%] min-w-0">
          {showHeader && (
            <div className="flex items-baseline gap-2 flex-wrap justify-end mb-1 px-1">
              <span className="text-xs text-neutral-dark">
                {relativeTime(message.created_at)}
                {message.edited_at && <span className="ml-1">(edited)</span>}
              </span>
              {message.pending_review && (
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-warning/15 text-warning">
                  Pending review
                </span>
              )}
            </div>
          )}

          {editing ? (
            <div className="w-full space-y-2">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full min-h-[60px] rounded-md border border-brand-border px-3 py-2 text-sm"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={submitEdit}
                  disabled={isPending}
                  className="px-3 py-1.5 rounded bg-navy text-white text-xs"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setBody(message.body);
                  }}
                  disabled={isPending}
                  className="px-3 py-1.5 rounded border border-brand-border text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`px-3.5 py-2 bg-navy text-white text-sm whitespace-pre-wrap break-words shadow-sm ${bubbleCornersOwn(groupPosition)}`}
            >
              {message.body}
              {message.link_url && (
                <div className="mt-1.5">
                  <a
                    href={message.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-accent hover:text-white hover:underline text-xs break-all"
                  >
                    {message.link_url}
                  </a>
                </div>
              )}
              {message.attachment_path && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-white/10 border border-white/20 px-3 py-1.5 text-xs max-w-full">
                  <span>📎</span>
                  {attachmentUrl ? (
                    <a
                      href={attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:underline truncate"
                    >
                      {message.attachment_name ?? "Attachment"}
                    </a>
                  ) : (
                    <span className="text-white/80 truncate">
                      {message.attachment_name ?? "Attachment"}
                    </span>
                  )}
                  {message.attachment_size != null && (
                    <span className="text-white/60 flex-shrink-0">
                      {formatBytes(message.attachment_size)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {!editing && (
            <div className="mt-1 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity text-xs px-1">
              {canEdit && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-neutral-dark hover:text-navy"
                >
                  Edit
                </button>
              )}
              {canDelete && (
                <button
                  onClick={submitDelete}
                  disabled={isPending}
                  className="text-neutral-dark hover:text-danger"
                >
                  Delete
                </button>
              )}
            </div>
          )}

          <ReadWatermark readers={watermarkReaders} />
        </div>

        {showReport && (
          <ReportDialog
            projectId={projectId}
            messageId={message.id}
            onClose={() => setShowReport(false)}
          />
        )}
      </div>
    );
  }

  // ===== OTHERS' MESSAGE (left-aligned light bubble) =====
  return (
    <div
      id={`msg-${message.id}`}
      className={`flex gap-2.5 group ${topSpacing}`}
    >
      <div className="flex-shrink-0 w-8">
        {showAvatar && (
          <div className="h-8 w-8 rounded-full bg-navy text-white flex items-center justify-center text-xs font-medium">
            {initials(senderName)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 max-w-[75%]">
        {showHeader && (
          <div className="flex items-baseline gap-2 flex-wrap mb-1 px-1">
            <span className="font-medium text-sm text-navy">{senderName}</span>
            <span
              className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${ROLE_COLORS[senderRole] ?? "bg-neutral-100"}`}
            >
              {senderRole.replace("_", " ")}
            </span>
            {message.sender?.organization && (
              <span className="text-xs text-neutral-dark">
                · {message.sender.organization}
              </span>
            )}
            <span className="text-xs text-neutral-dark">
              · {relativeTime(message.created_at)}
              {message.edited_at && <span className="ml-1">(edited)</span>}
            </span>
            {message.pending_review && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-warning/15 text-warning">
                Pending review
              </span>
            )}
          </div>
        )}

        {editing ? (
          <div className="space-y-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full min-h-[60px] rounded-md border border-brand-border px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={submitEdit}
                disabled={isPending}
                className="px-3 py-1.5 rounded bg-navy text-white text-xs"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setBody(message.body);
                }}
                disabled={isPending}
                className="px-3 py-1.5 rounded border border-brand-border text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`inline-block px-3.5 py-2 bg-[#F2F5FA] text-sm text-navy-soft whitespace-pre-wrap break-words max-w-full ${bubbleCornersOther(groupPosition)}`}
          >
            {message.body}
            {message.link_url && (
              <div className="mt-1.5">
                <a
                  href={message.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-accent hover:underline text-xs break-all"
                >
                  {message.link_url}
                </a>
              </div>
            )}
            {message.attachment_path && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-white border border-brand-border px-3 py-1.5 text-xs max-w-full">
                <span>📎</span>
                {attachmentUrl ? (
                  <a
                    href={attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-navy hover:underline truncate"
                  >
                    {message.attachment_name ?? "Attachment"}
                  </a>
                ) : (
                  <span className="text-neutral-dark truncate">
                    {message.attachment_name ?? "Attachment"}
                  </span>
                )}
                {message.attachment_size != null && (
                  <span className="text-neutral-dark flex-shrink-0">
                    {formatBytes(message.attachment_size)}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {!editing && (
          <div className="mt-1 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity text-xs px-1">
            {canDelete && (
              <button
                onClick={submitDelete}
                disabled={isPending}
                className="text-neutral-dark hover:text-danger"
              >
                Delete
              </button>
            )}
            {canApprove && (
              <button
                onClick={submitApprove}
                disabled={isPending}
                className="text-neutral-dark hover:text-success font-medium"
              >
                Approve
              </button>
            )}
            {canReport && (
              <button
                onClick={() => setShowReport(true)}
                className="text-neutral-dark hover:text-warning"
              >
                Report
              </button>
            )}
          </div>
        )}

        <ReadWatermark readers={watermarkReaders} />
      </div>

      {showReport && (
        <ReportDialog
          projectId={projectId}
          messageId={message.id}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}

function bubbleCornersOwn(pos: GroupPosition): string {
  switch (pos) {
    case "solo":
      return "rounded-2xl rounded-br-md";
    case "first":
      return "rounded-2xl rounded-br-md";
    case "middle":
      return "rounded-l-2xl rounded-r-md";
    case "last":
      return "rounded-l-2xl rounded-tr-md rounded-br-2xl";
  }
}

function bubbleCornersOther(pos: GroupPosition): string {
  switch (pos) {
    case "solo":
      return "rounded-2xl rounded-bl-md";
    case "first":
      return "rounded-2xl rounded-bl-md";
    case "middle":
      return "rounded-r-2xl rounded-l-md";
    case "last":
      return "rounded-r-2xl rounded-tl-md rounded-bl-2xl";
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
