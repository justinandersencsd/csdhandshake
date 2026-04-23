import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { acceptCoc } from "./actions";

export default async function CocPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, role, coc_accepted_at")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  if (profile.coc_accepted_at) redirect("/");
  if (profile.role !== "partner") redirect("/");

  const { data: cocVersion } = await supabase
    .from("coc_versions")
    .select("version_number, content, effective_date")
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-medium text-navy">Code of conduct</h1>
          <p className="text-sm text-neutral-dark">
            Before you can message students, please read and accept each section below. Version {cocVersion?.version_number ?? 1}.
          </p>
        </div>

        <form action={acceptCoc} className="space-y-6">
          <input type="hidden" name="version" value={cocVersion?.version_number ?? 1} />

          <CocSection
            id="communication"
            title="1. Communication stays on the platform"
          >
            All communication with students must happen on CSD Handshake. I will not text, email, call,
            or contact students through social media or any other channel. I understand that doing so
            would be a violation of this agreement and could result in removal from the program.
          </CocSection>

          <CocSection
            id="oversight"
            title="2. Messages are monitored"
          >
            I understand that all messages I send and receive in CSD Handshake are visible to the
            teacher who invited me and to school and district administrators. Content is also
            automatically scanned for personal contact information and unsafe content.
          </CocSection>

          <CocSection
            id="professionalism"
            title="3. Professional conduct"
          >
            I will communicate with students in a professional, respectful manner appropriate for a
            school setting. I will not share personal opinions on politics or religion, discuss
            personal relationships, share inappropriate content, or use language I would not use in a
            classroom.
          </CocSection>

          <CocSection
            id="reporting"
            title="4. Reporting concerns"
          >
            If I become aware of anything concerning — a student in distress, unsafe behavior, or
            messages from someone other than the student — I will immediately notify the teacher
            through the platform or by contacting the school directly.
          </CocSection>

          <CocSection
            id="privacy"
            title="5. Student privacy"
          >
            I will not collect, share, or use students&apos; personal information outside of the
            project. I will not photograph or record students, or include them in any external
            communication without explicit permission from the teacher and school.
          </CocSection>

          <div className="space-y-1 pt-2">
            <label htmlFor="typed_name" className="text-sm font-medium text-navy">
              Type your full name to confirm
            </label>
            <input
              id="typed_name"
              name="typed_name"
              type="text"
              required
              placeholder={profile.full_name}
              className="w-full rounded-md border border-brand-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-neutral-dark">
              Must match: <strong>{profile.full_name}</strong>
            </p>
          </div>

          {sp.error && (
            <p className="text-sm bg-danger-bg text-danger-text p-2 rounded">{sp.error}</p>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-navy text-surface py-2.5 text-sm font-medium hover:bg-navy-soft transition"
          >
            I accept — continue to CSD Handshake
          </button>
        </form>
      </div>
    </main>
  );
}

function CocSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-brand-border rounded-lg p-4 bg-surface space-y-2">
      <h2 className="font-medium text-navy">{title}</h2>
      <p className="text-sm text-neutral-dark">{children}</p>
      <label className="flex items-center gap-2 text-sm text-navy pt-1">
        <input
          type="checkbox"
          name={`section_${id}`}
          required
          className="rounded border-brand-border"
        />
        I have read and agree to this section
      </label>
    </div>
  );
}
