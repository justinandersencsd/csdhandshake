"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function requestPasswordReset(formData: FormData) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();

  if (!email) {
    redirect(`/forgot-password?error=${encodeURIComponent("Email is required")}`);
  }

  const supabase = await createClient();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  // We don't surface whether the email exists — always show success.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
  });

  redirect("/forgot-password?sent=1");
}
