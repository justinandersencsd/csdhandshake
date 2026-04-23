import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: cocVersions, error } = await supabase
    .from("coc_versions")
    .select("*");

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-medium text-navy">CSD Handshake</h1>
          <p className="text-neutral-dark">
            Canyons School District&apos;s student–partner platform.
          </p>
        </div>

        <div className="border border-brand-border rounded-lg p-4 bg-surface">
          <h2 className="font-medium text-navy mb-2">Supabase connection test</h2>
          {error ? (
            <p className="text-danger-text bg-danger-bg p-2 rounded text-sm">
              Error: {error.message}
            </p>
          ) : (
            <div className="text-sm space-y-1">
              <p className="text-success-text bg-success-bg p-2 rounded">
                ✓ Connected — found {cocVersions?.length ?? 0} COC version(s)
              </p>
              {cocVersions?.map((v) => (
                <pre key={v.id} className="text-xs text-neutral-dark bg-muted p-2 rounded mt-2 overflow-auto">
{JSON.stringify(v, null, 2)}
                </pre>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-center">
          <span className="px-3 py-1 rounded-full text-sm bg-role-student-bg text-role-student-text">Student</span>
          <span className="px-3 py-1 rounded-full text-sm bg-role-partner-bg text-role-partner-text">Partner</span>
          <span className="px-3 py-1 rounded-full text-sm bg-role-teacher-bg text-role-teacher-text">Teacher</span>
          <span className="px-3 py-1 rounded-full text-sm bg-role-admin-bg text-role-admin-text">Admin</span>
        </div>
      </div>
    </main>
  );
}