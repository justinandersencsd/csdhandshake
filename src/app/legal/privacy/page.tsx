import Link from "next/link";
import { Logo } from "@/components/logo";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#F2F5FA]">
      <header className="bg-surface/85 backdrop-blur border-b border-brand-border">
        <div className="mx-auto max-w-3xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="font-serif italic text-2xl text-navy leading-none">
              Handshake
            </span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        <Link href="/" className="text-xs text-neutral-dark hover:text-navy">
          ← Back
        </Link>

        <h1 className="font-serif text-3xl sm:text-4xl text-navy">
          Privacy Policy
        </h1>
        <p className="text-xs text-neutral-dark">
          Placeholder — replace with legally reviewed copy before public use.
          Must be reviewed against FERPA, COPPA, and district policy.
        </p>

        <section className="space-y-4 text-sm text-navy-soft leading-relaxed">
          <h2 className="font-serif text-xl text-navy pt-4">What we collect</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Your name and email address (provided at invitation)</li>
            <li>Your organization (for external partners)</li>
            <li>Messages you post in project threads</li>
            <li>Files and links you share</li>
            <li>Login timestamps and IP addresses (for security auditing)</li>
            <li>Content that triggers the platform&apos;s safety filter</li>
          </ul>

          <h2 className="font-serif text-xl text-navy pt-4">Who can see your data</h2>
          <p>
            Messages are visible to: other members of the same project,
            teachers at your school, and district administrators. Admins can
            also view audit events (logins, actions, content flags). The
            district does not sell or share your data with third parties
            outside the vendors we use to operate this service.
          </p>

          <h2 className="font-serif text-xl text-navy pt-4">Vendors</h2>
          <p>
            Handshake runs on Supabase (database + authentication), Vercel
            (hosting), and Resend (email delivery). Each of these vendors
            processes data on the district&apos;s behalf under contract.
          </p>

          <h2 className="font-serif text-xl text-navy pt-4">Retention</h2>
          <p>
            Messages are retained indefinitely unless deleted by a district
            administrator. Deactivated users&apos; historical messages remain in
            place for record-keeping.
          </p>

          <h2 className="font-serif text-xl text-navy pt-4">Your rights</h2>
          <p>
            Under FERPA, students (or parents for students under 18) may
            request access to or correction of education records. Contact the
            district to make a request.
          </p>

          <h2 className="font-serif text-xl text-navy pt-4">Students under 13</h2>
          <p>
            If you are under 13, a parent or guardian must provide consent
            before you may use this platform, consistent with COPPA.
          </p>

          <h2 className="font-serif text-xl text-navy pt-4">Security incidents</h2>
          <p>
            If we discover a data breach affecting you, we will notify you
            under applicable law, typically within 60 days of discovery.
          </p>

          <p className="pt-8 text-xs text-neutral-dark">
            Questions? Contact {process.env.SUPPORT_EMAIL || "handshake@canyonsdistrict.org"}.
          </p>
        </section>
      </div>
    </main>
  );
}
