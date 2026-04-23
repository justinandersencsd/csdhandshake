type Role = "student" | "partner" | "teacher" | "school_admin" | "district_admin";

const styles: Record<Role, string> = {
  student: "bg-role-student-bg text-role-student-text",
  partner: "bg-role-partner-bg text-role-partner-text",
  teacher: "bg-role-teacher-bg text-role-teacher-text",
  school_admin: "bg-role-admin-bg text-role-admin-text",
  district_admin: "bg-role-admin-bg text-role-admin-text",
};

const labels: Record<Role, string> = {
  student: "Student",
  partner: "Partner",
  teacher: "Teacher",
  school_admin: "Admin",
  district_admin: "Admin",
};

export function RoleBadge({ role, size = "sm" }: { role: Role; size?: "xs" | "sm" }) {
  const sizeClass = size === "xs" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";
  return (
    <span className={`inline-block rounded-full font-medium ${sizeClass} ${styles[role]}`}>
      {labels[role]}
    </span>
  );
}
