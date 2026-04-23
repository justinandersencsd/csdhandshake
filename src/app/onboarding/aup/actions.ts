"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export async function acceptAup(formData: FormData) {
  const typedName = (formData.get("typed_name") as string)?.trim();

  if (!formData.get("agree")) {
    redirect(
      `/onboarding/aup?error=${encodeURIComponent("Please check the box to agree")}`
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  if (typedName.toLowerCase() !== profile.full_name.toLowerCase()) {
    redirect(
      `/onboarding/aup?error=${encodeURIComponent(`Typed name must match your full name: ${profile.full_name}`)}`
    );
  }

  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({
      coc_accepted_version: 1,
      coc_accepted_at: new Date().toISOString(),
      coc_accepted_ip: ip,
    })
    .eq("id", user.id);

  if (error) {
    redirect(
      `/onboarding/aup?error=${encodeURIComponent("Failed to record acceptance. Please try again.")}`
    );
  }

  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "user.aup_accepted",
    target_type: "user",
    target_id: user.id,
    metadata: { ip },
    ip_address: ip,
  });

  redirect("/");
}
