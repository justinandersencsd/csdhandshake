import Link from "next/link";
import { relativeTime, truncate } from "@/lib/format";

type Member = { full_name: string; role: string };
type LastMessage = { sender_name: string; body: string; created_at: string } | null;

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
  const students = members.filter((m) => m.role === "student").map((m) => m.full_name);
  const displayStudents =
    students.slice(0, 3).join(", ") +
    (students.length > 3 ? ` and ${students.length - 3} more` : "");

  return (
    <Link
      href={`/projects/${project.id}`}
      className={`block border ${
        archived ? "opacity-60" : ""
      } border-brand-border rounded-lg p-4 bg-surface hover:border-accent transition`}
    >
      <div className="flex items-start justify-between mb-1.5 gap-2">
        <h3 className="font-medium text-navy">{project.name}</h3>
        {archived && (
          <span className="text-xs bg-muted text-neutral-dark px-2 py-0.5 rounded-full shrink-0">
            Archived
          </span>
        )}
      </div>
      <p className="text-sm text-neutral-dark mb-2">
        {displayStudents || "No students yet"}
        {project.partner_organization ? ` · ${project.partner_organization}` : ""}
      </p>
      {lastMessage ? (
        <p className="text-sm text-neutral-dark">
          <span className="text-navy font-medium">{lastMessage.sender_name}:</span>{" "}
          {truncate(lastMessage.body, 80)}
          <span className="text-xs ml-2 whitespace-nowrap">
            · {relativeTime(lastMessage.created_at)}
          </span>
        </p>
      ) : (
        <p className="text-sm text-neutral-dark italic">No messages yet</p>
      )}
    </Link>
  );
}
