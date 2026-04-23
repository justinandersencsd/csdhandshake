"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function updateNotificationPrefs(formData: FormData) {
  const email_frequency = (formData.get("email_frequency") as string) || "immediate";
  const in_app_enabled = formData.get("in_app_enabled") === "on";
  const email_flags_only = formData.get("email_flags_only") === "on";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const prefs = {
    email_frequency,
    in_app_enabled,
    email_flags_only,
  };

  const { error } = await supabase
    .from("users")
    .update({ notification_prefs: prefs })
    .eq("id", user.id);

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/settings");
  redirect("/settings?success=Preferences+saved");
}
