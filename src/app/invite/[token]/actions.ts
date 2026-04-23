"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export async function acceptInvitation(formData: FormData) {
  const token = formData.get("token") as string;
  const password = formData.get("password") as string;
  const confirm = formData.get("confirm") as string;

  if (!token || !password) {
    redirect(`/invite/${token}?error=${encodeURIComponent("Password is required")}`);
  }

  if (password.length < 8) {
    redirect(`/invite/${token}?error=${encodeURIComponent("Password must be at least 8 characters")}`);
  }

  if (password !== confirm) {
    redirect(`/invite/${token}?error=${encodeURIComponent("Passwords do not match")}`);
  }

  const admin = createAdminClient();

  // Look up invitation
  const { data: invitation, error: invitationError } = await admin
    .from("invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (invitationError || !invitation) {
    redirect(`/invite/${token}?error=${encodeURIComponent("Invitation not found")}`);
  }

  if (invitation.accepted_at) {
    redirect(`/invite/${token}?error=${encodeURIComponent("This invitation has already been used")}`);
  }

  if (new Date(invitation.expires_at) < new Date()) {
    redirect(`/invite/${token}?error=${encodeURIComponent("This invitation has expired")}`);
  }

  // Create auth user
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: invitation.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: invitation.full_name },
  });

  if (authError || !authUser.user) {
    redirect(
      `/invite/${token}?error=${encodeURIComponent("Failed to create account: " + (authError?.message ?? "unknown error"))}`
    );
  }

  // Create users row (bypasses RLS because we're using admin client)
  const { error: userInsertError } = await admin.from("users").insert({
    id: authUser.user.id,
    email: invitation.email,
    full_name: invitation.full_name,
    role: invitation.role,
    school_id: invitation.school_id,
    organization: invitation.organization,
    status: "active",
  });

  if (userInsertError) {
    // Roll back the auth user creation
    await admin.auth.admin.deleteUser(authUser.user.id);
    redirect(
      `/invite/${token}?error=${encodeURIComponent("Failed to set up profile: " + userInsertError.message)}`
    );
  }

  // Mark invitation accepted
  await admin
    .from("invitations")
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by: authUser.user.id,
    })
    .eq("id", invitation.id);

  // Audit event
  await admin.from("audit_events").insert({
    user_id: authUser.user.id,
    event_type: "user.accepted_invitation",
    target_type: "invitation",
    target_id: invitation.id,
    metadata: { email: invitation.email, role: invitation.role },
  });

  // Sign the new user in (using regular server client so cookies get set)
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: invitation.email,
    password,
  });

  if (signInError) {
    // Account was created successfully, just couldn't auto-sign them in.
    // Send to login with a helpful message.
    redirect(`/login?error=${encodeURIComponent("Account created. Please sign in.")}`);
  }

  // Redirect based on role
  if (invitation.role === "partner") {
    redirect("/onboarding/coc");
  } else if (invitation.role === "student") {
    redirect("/onboarding/aup");
  } else {
    redirect("/");
  }
}
