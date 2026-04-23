import Link from "next/link";
import { relativeTime, truncate, initials } from "@/lib/format";

const ROLE_COLORS: Record<string, string> = {
  student: "bg-role-student/15 text-role-student",
  partner: "bg-role-partner/15 text-role-partner",
  teacher: "bg-role-teacher/15 text-role-teacher",
  school_admin: "bg-role-admin/15 text-role-admin",
  district_admin: "bg-role-admin/15 text-role-admin",
};

type Project = {
  id: string;
  name: string;
  status: string;
  partner_organization: string | null;
  updated_at: string;
};

type Member = {
  full_name: string;
  role: string;
};

type LastMessage = {
  sender_name: string;
  body: string;
  created_at: string;
} | null;

export function ProjectCard({
  project,
  members,
  lastMessage,
  unreadCount = 0,
}: {
  project: Project;
  members: Member[];
  lastMessage: LastMessage;
  unreadCount?: number;
}) {
  const isArchived = project.status === "archived";
  const displayedMembers = members.slice(0, 4);
  const extraCount = Math.max(0, members.length - 4);

  return (
    <Link
      href={`/projects/${project.id}`}
      className="card-pressable group relative block bg-surface rounded-xl border border-brand-border overflow-hidden hover:border-navy hover:shadow-sm transition-all duration-150"
    >
      <div
        className={`absolute left-0 top-0 bottom-0 w-0.5 transition ${
          isArchived
            ? "bg-neutral-300 group-hover:bg-neutral-400"
            : "bg-brand-accent group-hover:bg-navy"
        }`}
      />
      <div className="p-5 pl-6 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-lg text-navy leading-tight truncate">
                {project.name}
              </h3>
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-navy text-white text-[10px] font-medium">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
            {project.partner_organization && (
              <div className="text-xs text-neutral-dark truncate">
                with{" "}
                <span className="font-serif italic text-neutral-dark">
                  {project.partner_organization}
                </span>
              </div>
            )}
          </div>
          {isArchived && (
            <span className="text-[10px] uppercase tracking-wider text-neutral-dark flex-shrink-0">
              Archived
            </span>
          )}
        </div>

        {lastMessage ? (
          <div className="space-y-1">
            <div className="text-xs text-neutral-dark">
              <span className="font-medium text-navy">
                {lastMessage.sender_name}
              </span>
              <span className="mx-1">·</span>
              <span>{relativeTime(lastMessage.created_at)}</span>
            </div>
            <p className="text-sm text-navy-soft">
              {truncate(lastMessage.body, 120)}
            </p>
          </div>
        ) : (
          <p className="text-sm text-neutral-dark italic">
            No messages yet. Say hello.
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex -space-x-2">
            {displayedMembers.map((m, i) => (
              <div
                key={i}
                title={`${m.full_name} (${m.role.replace("_", " ")})`}
                className={`h-7 w-7 rounded-full border-2 border-surface flex items-center justify-center text-[10px] font-medium ${
                  ROLE_COLORS[m.role] ?? "bg-neutral-100 text-neutral-700"
                }`}
              >
                {initials(m.full_name)}
              </div>
            ))}
            {extraCount > 0 && (
              <div className="h-7 w-7 rounded-full border-2 border-surface bg-neutral-100 text-neutral-700 flex items-center justify-center text-[10px] font-medium">
                +{extraCount}
              </div>
            )}
          </div>
          <div className="text-xs text-neutral-dark">
            {members.length} {members.length === 1 ? "member" : "members"}
          </div>
        </div>
      </div>
    </Link>
  );
}
