"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInvitationEmail } from "@/lib/email/send-invitation";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("users")
    .select("id, role, school_id, full_name")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");
  if (profile.role !== "school_admin" && profile.role !== "district_admin") {
    redirect("/");
  }
  return { user, profile };
}

async function requireDistrictAdmin() {
  const ctx = await requireAdmin();
  if (ctx.profile.role !== "district_admin") {
    redirect("/admin?error=District+admin+only");
  }
  return ctx;
}

export async function dismissFlag(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;
  const { user } = await requireAdmin();

  const admin = createAdminClient();
  await admin
    .from("content_flags")
    .update({
      status: "dismissed",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "flag.dismissed",
    target_type: "content_flag",
    target_id: id,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/flags");
}

export async function acknowledgeFlag(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;
  const { user } = await requireAdmin();

  const admin = createAdminClient();
  await admin
    .from("content_flags")
    .update({
      status: "acknowledged",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "flag.acknowledged",
    target_type: "content_flag",
    target_id: id,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/flags");
}

export async function resolveReport(formData: FormData) {
  const id = formData.get("id") as string;
  const action = formData.get("action") as "dismiss" | "acknowledge";
  if (!id) return;
  const { user } = await requireAdmin();

  const admin = createAdminClient();
  await admin
    .from("message_reports")
    .update({
      status: action === "dismiss" ? "dismissed" : "acknowledged",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: action === "dismiss" ? "report.dismissed" : "report.acknowledged",
    target_type: "message_report",
    target_id: id,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/flags");
}

export async function deactivateUser(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;
  const { user } = await requireDistrictAdmin();
  if (id === user.id) {
    redirect("/admin/users?error=Cannot+deactivate+yourself");
  }

  const admin = createAdminClient();
  await admin
    .from("users")
    .update({ deactivated_at: new Date().toISOString() })
    .eq("id", id);

  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "user.deactivated",
    target_type: "user",
    target_id: id,
  });

  revalidatePath("/admin/users");
  redirect("/admin/users?success=User+deactivated");
}

export async function reactivateUser(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;
  const { user } = await requireDistrictAdmin();

  const admin = createAdminClient();
  await admin
    .from("users")
    .update({ deactivated_at: null })
    .eq("id", id);

  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "user.reactivated",
    target_type: "user",
    target_id: id,
  });

  revalidatePath("/admin/users");
  redirect("/admin/users?success=User+reactivated");
}

export async function changeUserRole(formData: FormData) {
  const id = formData.get("id") as string;
  const newRole = formData.get("role") as string;
  const allowed = [
    "student",
    "partner",
    "teacher",
    "school_admin",
    "district_admin",
  ];
  if (!id || !allowed.includes(newRole)) {
    redirect("/admin/users?error=Invalid+role");
  }
  const { user } = await requireDistrictAdmin();

  const admin = createAdminClient();
  await admin.from("users").update({ role: newRole }).eq("id", id);

  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "user.role_changed",
    target_type: "user",
    target_id: id,
    metadata: { new_role: newRole },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users?success=Role+updated");
}

// ---------------------------------------------------------------------
// Admin-scoped invitation management (works across all projects, not just owned)
// ---------------------------------------------------------------------

export async function adminResendInvitation(formData: FormData) {
  const invitation_id = formData.get("invitation_id") as string;
  if (!invitation_id) redirect("/admin?error=Missing+invitation");

  const { user, profile } = await requireAdmin();

  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("invitations")
    .select(
      "id, email, full_name, role, organization, accepted_at, project_id, school_id"
    )
    .eq("id", invitation_id)
    .maybeSingle();

  if (!invite) redirect("/admin?error=Invitation+not+found");
  if (invite.accepted_at) redirect("/admin?error=Already+accepted");

  // School admins can only act on invitations for their own school
  if (
    profile.role === "school_admin" &&
    invite.school_id !== profile.school_id
  ) {
    redirect("/admin?error=Not+authorized");
  }

  // Generate a new token + extend expiry
  const newToken = crypto.randomBytes(32).toString("hex");
  const newExpiry = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error: updateError } = await admin
    .from("invitations")
    .update({ token: newToken, expires_at: newExpiry })
    .eq("id", invitation_id);

  if (updateError) {
    redirect(
      `/admin?error=${encodeURIComponent("Update failed: " + updateError.message)}`
    );
  }

  const { data: school } = await admin
    .from("schools")
    .select("name")
    .eq("id", invite.school_id)
    .maybeSingle();

  const { data: proj } = invite.project_id
    ? await admin
        .from("projects")
        .select("name")
        .eq("id", invite.project_id)
        .maybeSingle()
    : { data: null };

  try {
    await sendInvitationEmail({
      to: invite.email,
      inviteeName: invite.full_name,
      inviterName: profile.full_name,
      schoolName: school?.name ?? "Canyons School District",
      projectName: proj?.name ?? null,
      token: newToken,
      role: invite.role as "student" | "partner",
    });
  } catch (e) {
    redirect(
      `/admin?error=${encodeURIComponent("Email failed: " + (e as Error).message)}`
    );
  }

  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "invitation.resent",
    target_type: "invitation",
    target_id: invitation_id,
    metadata: { email: invite.email, via: "admin_dashboard" },
  });

  revalidatePath("/admin");
  redirect(
    `/admin?success=Invitation+resent+to+${encodeURIComponent(invite.email)}`
  );
}

export async function adminCancelInvitation(formData: FormData) {
  const invitation_id = formData.get("invitation_id") as string;
  if (!invitation_id) redirect("/admin?error=Missing+invitation");

  const { user, profile } = await requireAdmin();

  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("invitations")
    .select("id, email, school_id, accepted_at")
    .eq("id", invitation_id)
    .maybeSingle();

  if (!invite) redirect("/admin?error=Invitation+not+found");
  if (invite.accepted_at) redirect("/admin?error=Already+accepted");

  if (
    profile.role === "school_admin" &&
    invite.school_id !== profile.school_id
  ) {
    redirect("/admin?error=Not+authorized");
  }

  const { error } = await admin
    .from("invitations")
    .delete()
    .eq("id", invitation_id);

  if (error) {
    redirect(
      `/admin?error=${encodeURIComponent("Cancel failed: " + error.message)}`
    );
  }

  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "invitation.cancelled",
    target_type: "invitation",
    target_id: invitation_id,
    metadata: { email: invite.email, via: "admin_dashboard" },
  });

  revalidatePath("/admin");
  redirect(`/admin?success=Invitation+cancelled`);
}
