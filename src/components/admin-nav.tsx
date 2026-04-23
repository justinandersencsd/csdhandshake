import Link from "next/link";

const ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/flags", label: "Flagged content" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit", label: "Audit log" },
];

export function AdminNav({ active }: { active: string }) {
  return (
    <nav className="space-y-0.5">
      <div className="text-[11px] uppercase tracking-[0.15em] text-neutral-dark mb-2 pl-3">
        Administration
      </div>
      {ITEMS.map((item) => {
        const isActive =
          active === item.href ||
          (item.href !== "/admin" && active.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-3 py-1.5 rounded-md text-sm transition-all duration-100 active:scale-[0.98] ${
              isActive
                ? "bg-navy text-white"
                : "text-neutral-dark hover:bg-neutral-100 hover:text-navy"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
