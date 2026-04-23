"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

type UnreadProject = {
  id: string;
  name: string;
  count: number;
  lastMessageAt: string | null;
};

export function NotificationsBell({
  projects,
  totalUnread,
}: {
  projects: UnreadProject[];
  totalUnread: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onClick);
      return () => document.removeEventListener("mousedown", onClick);
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative h-9 w-9 rounded-full flex items-center justify-center hover:bg-neutral-100 transition"
      >
        <BellIcon />
        {totalUnread > 0 && (
          <span className="absolute top-0.5 right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-danger text-white text-[9px] font-medium flex items-center justify-center leading-none">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-surface rounded-lg border border-brand-border shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-border flex items-center justify-between">
            <h3 className="font-serif text-sm text-navy">Notifications</h3>
            {totalUnread > 0 && (
              <span className="text-[11px] text-neutral-dark">
                {totalUnread} unread
              </span>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {projects.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-neutral-dark">
                You&apos;re all caught up.
              </div>
            ) : (
              <ul>
                {projects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-start justify-between gap-2 px-4 py-3 hover:bg-neutral-50 transition border-b border-brand-border/50 last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm text-navy truncate">
                          {p.name}
                        </div>
                        <div className="text-xs text-neutral-dark mt-0.5">
                          {p.count} new {p.count === 1 ? "message" : "messages"}
                        </div>
                      </div>
                      <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-navy text-white text-[10px] font-medium flex-shrink-0">
                        {p.count}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="px-4 py-2 border-t border-brand-border bg-[#F2F5FA]">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="text-[11px] text-neutral-dark hover:text-navy"
            >
              Notification preferences →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-navy"
    >
      <path d="M10 2a5 5 0 0 0-5 5v3l-1.5 2.5h13L15 10V7a5 5 0 0 0-5-5z" />
      <path d="M8 15a2 2 0 0 0 4 0" />
    </svg>
  );
}
