import Link from "next/link";
import { Logo } from "./logo";
import { logout } from "@/app/login/actions";
import { initials } from "@/lib/format";

type Profile = {
  full_name: string;
  role: string;
  email: string;
};

export function AppHeader({
  profile,
  canInvite,
  canCreateProject,
}: {
  profile: Profile;
  canInvite: boolean;
  canCreateProject: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-brand-border bg-surface/90 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <Logo className="h-10 w-10" />
          <span className="font-serif text-2xl text-navy italic leading-none pt-1">
            Handshake
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {canCreateProject && (
            <Link
              href="/projects/new"
              className="h-8 px-3 inline-flex items-center rounded-md bg-navy text-surface text-sm font-medium hover:bg-navy-soft transition"
            >
              + New project
            </Link>
          )}
          {canInvite && (
            <Link
              href="/admin/invite"
              className="h-8 px-3 inline-flex items-center rounded-md text-neutral-dark hover:text-navy hover:bg-muted text-sm transition"
            >
              Invite
            </Link>
          )}
          <div className="h-6 w-px bg-brand-border mx-2" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-navy text-surface text-[11px] font-medium flex items-center justify-center">
              {initials(profile.full_name)}
            </div>
            <span className="text-sm text-navy hidden sm:inline">
              {profile.full_name}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="h-8 px-2 text-sm text-neutral-dark hover:text-navy transition ml-1"
                title="Sign out"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}