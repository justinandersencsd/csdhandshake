export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-3xl font-medium text-navy">CSD Handshake</h1>
        <p className="text-neutral-dark">
          Canyons School District&apos;s student–partner platform.
        </p>
        <div className="flex gap-2 justify-center pt-4">
          <span className="px-3 py-1 rounded-full text-sm bg-role-student-bg text-role-student-text">Student</span>
          <span className="px-3 py-1 rounded-full text-sm bg-role-partner-bg text-role-partner-text">Partner</span>
          <span className="px-3 py-1 rounded-full text-sm bg-role-teacher-bg text-role-teacher-text">Teacher</span>
          <span className="px-3 py-1 rounded-full text-sm bg-role-admin-bg text-role-admin-text">Admin</span>
        </div>
      </div>
    </main>
  );
}