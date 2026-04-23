"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInvitationEmail } from "@/lib/email/send-invitation";
import { redirect } from "next/navigation";
import crypto from "crypto";

export async function inviteUser(formData: FormData) {
  const full_name = (formData.get("full_name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const role = formData.get("role") as
    | "student"
    | "partner"
    | "teacher"
    | "school_admin"
    | "district_admin";
  const organization = (formData.get("organization") as string)?.trim() || null;
  const school_id = formData.get("school_id") as string;

  if (!full_name || !email || !role || !school_id) {
    redirect("/admin/invite?error=All+fields+are+required");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Get inviter's profile for the email
  const { data: inviter } = await supabase
    .from("users")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (!inviter || !["teacher", "school_admin", "district_admin"].includes(inviter.role)) {
    redirect("/admin/invite?error=You+are+not+authorized+to+invite+users");
  }

  // Check if user already exists
  const admin = createAdminClient();
  const { data: existingUser } = await admin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingUser) {
    redirect("/admin/invite?error=A+user+with+that+email+already+exists");
  }

  // Generate token and create invitation
  const token = crypto.randomBytes(32).toString("hex");
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: insertError } = await supabase.from("invitations").insert({
    email,
    full_name,
    role,
    organization,
    school_id,
    invited_by: user.id,
    token,
    expires_at,
  });

  if (insertError) {
    redirect(
      `/admin/invite?error=${encodeURIComponent("Failed to create invitation: " + insertError.message)}`
    );
  }

  // Get school name for email
  const { data: school } = await supabase
    .from("schools")
    .select("name")
    .eq("id", school_id)
    .single();

  // Send email
  try {
    await sendInvitationEmail({
      to: email,
      inviteeName: full_name,
      inviterName: inviter.full_name,
      schoolName: school?.name ?? "Canyons School District",
      token,
      role,
    });
  } catch (err) {
    redirect(
      `/admin/invite?error=${encodeURIComponent("Invitation created but email failed: " + (err as Error).message)}`
    );
  }

  // Audit event
  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "user.invited",
    target_type: "invitation",
    metadata: { email, role, school_id },
  });

  redirect(`/admin/invite?success=${encodeURIComponent(email)}`);
}
