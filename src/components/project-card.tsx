import Link from "next/link";
import { relativeTime, truncate, initials } from "@/lib/format";

type Role = "student" | "partner" | "teacher" | "school_admin" | "district_admin";
type Member = { full_name: string; role: Role };
type LastMessage = { sender_name: string; body: string; created_at: string } | null;

const roleColor: Record<string, string> = {
  student: "bg-role-student-bg text-role-student-text",
  partner: "bg-role-partner-bg text-role-partner-text",
  teacher: "bg-role-teacher-bg text-role-teacher-text",
  school_admin: "bg-role-admin-bg text-role-admin-text",
  district_admin: "bg-role-admin-bg text-role-admin-text",
};

export function ProjectCard({
  project,
  members,
  lastMessage,
}: {
  project: {
    id: string;
    name: string;
    status: string;
    partner_organization: string | null;
  };
  members: Member[];
  lastMessage: LastMessage;
}) {
  const archived = project.status === "archived";
  const students = members.filter((m) => m.role === "student");

  return (
    <Link
      href={`/projects/${project.id}`}
      className={`group relative block bg-surface border border-brand-border rounded-xl p-5 transition-all duration-200 hover:border-navy/30 hover:shadow-[0_1px_2px_rgba(22,40,68,0.05),0_8px_24px_-8px_rgba(22,40,68,0.15)] hover:-translate-y-0.5 ${
        archived ? "opacity-60" : ""
      }`}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${
              archived ? "bg-neutral-dark/30" : "bg-success-text"
            }`}
            aria-hidden="true"
          />
          <h3 className="font-serif text-xl text-navy leading-tight truncate">
            {project.name}
          </h3>
        </div>
        {archived && (
          <span className="shrink-0 text-[10px] uppercase tracking-widest bg-muted text-neutral-dark px-2 py-0.5 rounded-full">
            Archived
          </span>
        )}
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-neutral-dark mb-4 ml-[18px]">
        {project.partner_organization ? (
          <>
            <span className="text-navy font-medium">
              {project.partner_organization}
            </span>
            <span className="text-brand-border">·</span>
          </>
        ) : null}
        <span>
          {students.length} student{students.length === 1 ? "" : "s"}
        </span>
        <span className="text-brand-border">·</span>
        <span>
          {members.length} member{members.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Last message */}
      <div className="border-t border-brand-border pt-3 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {lastMessage ? (
            <>
              <p className="text-sm text-neutral-dark leading-relaxed">
                <span className="text-navy font-medium">
                  {lastMessage.sender_name}
                </span>
                : {truncate(lastMessage.body, 90)}
              </p>
              <p className="text-[11px] text-neutral-dark/70 mt-1.5 uppercase tracking-wider">
                {relativeTime(lastMessage.created_at)}
              </p>
            </>
          ) : (
            <p className="text-sm italic text-neutral-dark">
              Awaiting first message
            </p>
          )}
        </div>

        {/* Avatar stack */}
        {members.length > 0 && (
          <div className="flex -space-x-1.5 shrink-0 items-center">
            {members.slice(0, 4).map((m, i) => (
              <div
                key={i}
                className={`h-7 w-7 rounded-full border-2 border-surface flex items-center justify-center text-[10px] font-medium ${
                  roleColor[m.role] ?? "bg-muted text-foreground"
                }`}
                title={`${m.full_name} (${m.role.replace("_", " ")})`}
              >
                {initials(m.full_name)}
              </div>
            ))}
            {members.length > 4 && (
              <div className="h-7 w-7 rounded-full border-2 border-surface bg-muted text-neutral-dark flex items-center justify-center text-[10px] font-medium">
                +{members.length - 4}
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
