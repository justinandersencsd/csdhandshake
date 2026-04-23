"use client";

import { useState } from "react";
import { editMessage, deleteMessage } from "@/app/projects/[id]/actions";
import { RoleBadge } from "./role-badge";
import { relativeTime, initials, isWithin5Min } from "@/lib/format";

type Role = "student" | "partner" | "teacher" | "school_admin" | "district_admin";

type Props = {
  message: {
    id: string;
    body: string;
    attachment_url: string | null;
    attachment_label: string | null;
    created_at: string;
    edited_at: string | null;
    deleted_at: string | null;
    sender: { id: string; full_name: string; role: Role } | null;
  };
  currentUserId: string;
  isAdmin: boolean;
  projectId: string;
  projectArchived: boolean;
};

const roleColors: Record<Role, string> = {
  student: "bg-role-student-bg text-role-student-text",
  partner: "bg-role-partner-bg text-role-partner-text",
  teacher: "bg-role-teacher-bg text-role-teacher-text",
  school_admin: "bg-role-admin-bg text-role-admin-text",
  district_admin: "bg-role-admin-bg text-role-admin-text",
};

export function MessageItem({
  message,
  currentUserId,
  isAdmin,
  projectId,
  projectArchived,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);

  const isOwn = message.sender?.id === currentUserId;
  const isDeleted = !!message.deleted_at;
  const canEdit = !projectArchived && isOwn && !isDeleted && isWithin5Min(message.created_at);
  const canDelete = !projectArchived && isOwn && !isDeleted;

  async function handleEdit(formData: FormData) {
    setPending(true);
    try {
      await editMessage(projectId, message.id, formData);
      setEditing(false);
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this message? A tombstone will remain for other members.")) return;
    setPending(true);
    try {
      await deleteMessage(projectId, message.id);
    } finally {
      setPending(false);
    }
  }

  // Non-admin view of a deleted message: just a tombstone
  if (isDeleted && !isAdmin) {
    return (
      <div className="py-2 px-1">
        <p className="text-sm text-neutral-dark italic">
          {message.sender?.full_name ?? "A user"}: [removed by sender]
        </p>
      </div>
    );
  }

  return (
    <div className="py-3 px-1 flex gap-3 group">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
          message.sender ? roleColors[message.sender.role] : "bg-muted text-foreground"
        }`}
      >
        {message.sender ? initials(message.sender.full_name) : "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium text-navy text-sm">
            {message.sender?.full_name ?? "Unknown user"}
          </span>
          {message.sender && <RoleBadge role={message.sender.role} size="xs" />}
          <span className="text-xs text-neutral-dark">
            {relativeTime(message.created_at)}
            {message.edited_at && " · edited"}
          </span>
          {isDeleted && isAdmin && (
            <span className="text-[10px] bg-warning-bg text-warning-text px-1.5 py-0.5 rounded">
              deleted (admin view)
            </span>
          )}
        </div>

        {editing ? (
          <form action={handleEdit} className="mt-1 space-y-2">
            <textarea
              name="body"
              defaultValue={message.body}
              required
              rows={2}
              className="w-full rounded-md border border-brand-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-navy text-surface px-3 py-1 text-xs font-medium hover:bg-navy-soft disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md border border-brand-border px-3 py-1 text-xs text-navy hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-sm text-navy mt-0.5 whitespace-pre-wrap break-words">
              {message.body}
            </p>
            {message.attachment_url && (
              <a
                href={message.attachment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-2 rounded-md border border-brand-border bg-muted px-3 py-2 text-xs hover:border-accent"
              >
                <span className="text-navy">🔗 {message.attachment_label || "Link"}</span>
                <span className="text-neutral-dark">· opens in new tab</span>
              </a>
            )}
            {(canEdit || canDelete) && (
              <div className="mt-1 flex gap-3 text-xs opacity-60 group-hover:opacity-100 transition">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="text-neutral-dark hover:text-navy"
                  >
                    Edit
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={pending}
                    className="text-neutral-dark hover:text-danger-text disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
