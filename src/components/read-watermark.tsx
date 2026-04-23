"use client";

import { relativeTime, initials } from "@/lib/format";

export type Reader = {
  userId: string;
  fullName: string;
  role: string;
  lastReadAt: string;
};

const ROLE_BG: Record<string, string> = {
  student: "bg-role-student/40 text-role-student border-role-student/60",
  partner: "bg-role-partner/40 text-role-partner border-role-partner/60",
  teacher: "bg-role-teacher/40 text-role-teacher border-role-teacher/60",
  school_admin: "bg-role-admin/80 text-role-admin border-role-admin",
  district_admin: "bg-role-admin/80 text-role-admin border-role-admin",
};

/**
 * Tiny stacked avatars showing who has "seen up to this message."
 * Positioned flush-right, sits below the message bubble with tight spacing.
 */
export function ReadWatermark({ readers }: { readers: Reader[] }) {
  if (readers.length === 0) return null;

  return (
    <div className="flex justify-end mt-1 px-1">
      <div className="flex -space-x-1.5">
        {readers.map((r) => (
          <div
            key={r.userId}
            title={`${r.fullName} · seen ${relativeTime(r.lastReadAt)}`}
            className={`h-4 w-4 rounded-full border flex items-center justify-center text-[8px] font-medium leading-none ${
              ROLE_BG[r.role] ?? "bg-neutral-200 text-neutral-700 border-neutral-300"
            }`}
          >
            {initials(r.fullName).charAt(0)}
          </div>
        ))}
      </div>
    </div>
  );
}
