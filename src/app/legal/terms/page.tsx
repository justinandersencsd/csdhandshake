import Link from "next/link";
import { Logo } from "@/components/logo";

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="text-xs text-neutral-dark">
          Placeholder — replace with legally reviewed copy before public use.
        </p>

        <section className="space-y-4 text-sm text-navy-soft leading-relaxed">
          <h2 className="font-serif text-xl text-navy pt-4">1. About this service</h2>
          <p>
            CSD Handshake is operated by Canyons School District as a
            communication platform connecting students, teachers, and external
            business partners. Use of the platform is governed by district
            policy and by these terms.
          </p>

          <h2 className="font-serif text-xl text-navy pt-4">2. Who may use it</h2>
          <p>
            Access is by invitation only. Students must have parental consent
            per district policy. External partners must agree to the Partner
            Code of Conduct on first use. Accounts may be deactivated at any
            time by a district administrator.
          </p>

          <h2 className="font-serif text-xl text-navy pt-4">3. Acceptable use</h2>
          <p>
            All communication on this platform is subject to moderation. You
            agree not to share personal contact information (phone numbers,
            personal email, social handles), attempt to move conversations off
            the platform, or use the service for anything unrelated to the
            assigned project.
          </p>

          <h2 className="font-serif text-xl text-navy pt-4">4. Monitoring</h2>
          <p>
            All messages are visible to project teachers and to district
            administrators. Messages are stored in district-owned infrastructure
            and may be reviewed at any time. Content flagged by the platform
            filter may trigger notification to administrators.
          </p>

          <h2 className="font-serif text-xl text-navy pt-4">5. Data</h2>
          <p>
            See the <Link href="/legal/privacy" className="underline">Privacy
            Policy</Link> for details on what data is collected, how long it is
            retained, and how to request removal.
          </p>

          <h2 className="font-serif text-xl text-navy pt-4">6. Changes</h2>
          <p>
            The district may update these terms with notice to active users.
            Continued use after notice constitutes acceptance.
          </p>

          <p className="pt-8 text-xs text-neutral-dark">
            Questions? Contact {process.env.SUPPORT_EMAIL || "handshake@canyonsdistrict.org"}.
          </p>
        </section>
      </div>
    </main>
  );
}
