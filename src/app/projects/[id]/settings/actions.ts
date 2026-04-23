"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInvitationEmail } from "@/lib/email/send-invitation";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

async function requireOwnerOrAdmin(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, created_by, school_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) redirect("/");

  const isAdmin =
    profile.role === "school_admin" || profile.role === "district_admin";
  const isOwner = project.created_by === user.id;

  if (!isOwner && !isAdmin) {
    redirect(`/projects/${projectId}?error=Not+authorized`);
  }

  return { user, profile, project };
}

function invalidateProject(projectId: string) {
  revalidatePath("/");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
}

export async function updateProject(formData: FormData) {
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const partner_organization =
    (formData.get("partner_organization") as string)?.trim() || null;

  if (!id || !name) {
    redirect(`/projects/${id}/settings?error=Name+is+required`);
  }

  const { user } = await requireOwnerOrAdmin(id);

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ name, description, partner_organization })
    .eq("id", id);

  if (error) {
    redirect(
      `/projects/${id}/settings?error=${encodeURIComponent("Failed to save: " + error.message)}`
    );
  }

  const admin = createAdminClient();
  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "project.settings_changed",
    target_type: "project",
    target_id: id,
    metadata: { fields: ["name", "description", "partner_organization"] },
  });

  invalidateProject(id);
  redirect(`/projects/${id}/settings?success=Project+updated`);
}

export async function updateSafetySettings(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) redirect("/?error=Missing+project+id");

  const first_message_review_enabled =
    formData.get("first_message_review_enabled") === "on";
  const first_message_review_count = Math.max(
    1,
    Math.min(10, parseInt((formData.get("first_message_review_count") as string) || "3"))
  );
  const quiet_hours_enabled = formData.get("quiet_hours_enabled") === "on";
  const quiet_hours_start =
    (formData.get("quiet_hours_start") as string) || "20:00";
  const quiet_hours_end =
    (formData.get("quiet_hours_end") as string) || "08:00";
  const rate_limit_enabled = formData.get("rate_limit_enabled") === "on";
  const rate_limit_per_hour = Math.max(
    1,
    Math.min(100, parseInt((formData.get("rate_limit_per_hour") as string) || "10"))
  );

  const { user } = await requireOwnerOrAdmin(id);

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      first_message_review_enabled,
      first_message_review_count,
      quiet_hours_enabled,
      quiet_hours_start: quiet_hours_start + ":00",
      quiet_hours_end: quiet_hours_end + ":00",
      rate_limit_enabled,
      rate_limit_per_hour,
    })
    .eq("id", id);

  if (error) {
    redirect(
      `/projects/${id}/settings?error=${encodeURIComponent("Failed to save safety: " + error.message)}`
    );
  }

  const admin = createAdminClient();
  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "project.safety_changed",
    target_type: "project",
    target_id: id,
    metadata: {
      first_message_review_enabled,
      quiet_hours_enabled,
      rate_limit_enabled,
    },
  });

  invalidateProject(id);
  redirect(`/projects/${id}/settings?success=Safety+settings+updated`);
}

export async function archiveProject(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) redirect("/?error=Missing+project+id");

  const { user } = await requireOwnerOrAdmin(id);

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
      archived_by: user.id,
    })
    .eq("id", id);

  if (error) {
    redirect(
      `/projects/${id}/settings?error=${encodeURIComponent("Failed to archive: " + error.message)}`
    );
  }

  const admin = createAdminClient();
  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "project.archived",
    target_type: "project",
    target_id: id,
  });

  invalidateProject(id);
  redirect(`/projects/${id}/settings?success=Project+archived`);
}

export async function unarchiveProject(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) redirect("/?error=Missing+project+id");

  const { user } = await requireOwnerOrAdmin(id);

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ status: "active", archived_at: null, archived_by: null })
    .eq("id", id);

  if (error) {
    redirect(
      `/projects/${id}/settings?error=${encodeURIComponent("Failed to unarchive: " + error.message)}`
    );
  }

  const admin = createAdminClient();
  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "project.unarchived",
    target_type: "project",
    target_id: id,
  });

  invalidateProject(id);
  redirect(`/projects/${id}/settings?success=Project+unarchived`);
}

export type LookupResult =
  | { state: "existing_member"; fullName: string }
  | {
      state: "existing_can_add";
      userId: string;
      fullName: string;
      role: string;
      organization: string | null;
    }
  | { state: "previously_removed"; userId: string; fullName: string; role: string }
  | { state: "new" };

export async function lookupMemberEmail(
  projectId: string,
  rawEmail: string
): Promise<LookupResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return { state: "new" };

  await requireOwnerOrAdmin(projectId);

  const admin = createAdminClient();

  const { data: existingUser } = await admin
    .from("users")
    .select("id, full_name, role, organization")
    .eq("email", email)
    .maybeSingle();

  if (!existingUser) {
    return { state: "new" };
  }

  const { data: membership } = await admin
    .from("project_members")
    .select("project_id, left_at")
    .eq("project_id", projectId)
    .eq("user_id", existingUser.id)
    .maybeSingle();

  if (membership && !membership.left_at) {
    return { state: "existing_member", fullName: existingUser.full_name };
  }

  if (membership && membership.left_at) {
    return {
      state: "previously_removed",
      userId: existingUser.id,
      fullName: existingUser.full_name,
      role: existingUser.role,
    };
  }

  return {
    state: "existing_can_add",
    userId: existingUser.id,
    fullName: existingUser.full_name,
    role: existingUser.role,
    organization: existingUser.organization,
  };
}

export async function addExistingMember(formData: FormData) {
  const project_id = formData.get("project_id") as string;
  const user_id = formData.get("user_id") as string;

  if (!project_id || !user_id) {
    redirect(`/projects/${project_id}/settings?error=Missing+data`);
  }

  const { user } = await requireOwnerOrAdmin(project_id);

  const admin = createAdminClient();

  const { error } = await admin
    .from("project_members")
    .upsert(
      {
        project_id,
        user_id,
        project_role: "member",
        added_by: user.id,
        added_at: new Date().toISOString(),
        left_at: null,
      },
      { onConflict: "project_id,user_id" }
    );

  if (error) {
    redirect(
      `/projects/${project_id}/settings?error=${encodeURIComponent("Failed to add: " + error.message)}`
    );
  }

  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "project.member_added",
    target_type: "project",
    target_id: project_id,
    metadata: { added_user: user_id },
  });

  invalidateProject(project_id);
  redirect(`/projects/${project_id}/settings?success=Member+added`);
}

export async function inviteNewMember(formData: FormData) {
  const project_id = formData.get("project_id") as string;
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const full_name = (formData.get("full_name") as string)?.trim();
  const role = formData.get("role") as "student" | "partner";
  const organization = (formData.get("organization") as string)?.trim() || null;

  if (!project_id || !email || !full_name || !role) {
    redirect(`/projects/${project_id}/settings?error=All+fields+required`);
  }

  const { user, profile, project } = await requireOwnerOrAdmin(project_id);

  const token = crypto.randomBytes(32).toString("hex");
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const supabase = await createClient();
  const { error: inviteError } = await supabase.from("invitations").insert({
    email,
    full_name,
    role,
    organization,
    project_id,
    school_id: project.school_id,
    invited_by: user.id,
    token,
    expires_at,
  });

  if (inviteError) {
    redirect(
      `/projects/${project_id}/settings?error=${encodeURIComponent("Failed to invite: " + inviteError.message)}`
    );
  }

  const admin = createAdminClient();
  const { data: school } = await admin
    .from("schools")
    .select("name")
    .eq("id", project.school_id)
    .maybeSingle();

  const { data: proj } = await admin
    .from("projects")
    .select("name")
    .eq("id", project_id)
    .maybeSingle();

  try {
    await sendInvitationEmail({
      to: email,
      inviteeName: full_name,
      inviterName: profile.full_name,
      schoolName: school?.name ?? "Canyons School District",
      projectName: proj?.name ?? null,
      token,
      role,
    });
  } catch (e) {
    redirect(
      `/projects/${project_id}/settings?error=${encodeURIComponent("Invite created, email failed: " + (e as Error).message)}`
    );
  }

  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "user.invited",
    target_type: "invitation",
    metadata: { email, role, project_id },
  });

  invalidateProject(project_id);
  redirect(
    `/projects/${project_id}/settings?success=Invitation+sent+to+${encodeURIComponent(email)}`
  );
}

export async function removeMember(formData: FormData) {
  const project_id = formData.get("project_id") as string;
  const user_id = formData.get("user_id") as string;
  const { user } = await requireOwnerOrAdmin(project_id);

  const admin = createAdminClient();

  const { error } = await admin
    .from("project_members")
    .update({ left_at: new Date().toISOString() })
    .eq("project_id", project_id)
    .eq("user_id", user_id);

  if (error) {
    redirect(
      `/projects/${project_id}/settings?error=${encodeURIComponent("Failed to remove: " + error.message)}`
    );
  }

  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "project.member_removed",
    target_type: "project",
    target_id: project_id,
    metadata: { removed_user: user_id },
  });

  invalidateProject(project_id);
  redirect(`/projects/${project_id}/settings?success=Member+removed`);
}

export async function resendInvitation(formData: FormData) {
  const invitation_id = formData.get("invitation_id") as string;
  const project_id = formData.get("project_id") as string;
  if (!invitation_id || !project_id) {
    redirect(`/projects/${project_id}/settings?error=Missing+data`);
  }

  const { user, profile, project } = await requireOwnerOrAdmin(project_id);

  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("invitations")
    .select("id, email, full_name, role, organization, accepted_at")
    .eq("id", invitation_id)
    .maybeSingle();

  if (!invite) {
    redirect(`/projects/${project_id}/settings?error=Invitation+not+found`);
  }
  if (invite.accepted_at) {
    redirect(`/projects/${project_id}/settings?error=Already+accepted`);
  }

  // Generate a new token and extend expiry
  const newToken = crypto.randomBytes(32).toString("hex");
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: updateError } = await admin
    .from("invitations")
    .update({ token: newToken, expires_at: newExpiry })
    .eq("id", invitation_id);

  if (updateError) {
    redirect(
      `/projects/${project_id}/settings?error=${encodeURIComponent("Update failed: " + updateError.message)}`
    );
  }

  const { data: school } = await admin
    .from("schools")
    .select("name")
    .eq("id", project.school_id)
    .maybeSingle();

  const { data: proj } = await admin
    .from("projects")
    .select("name")
    .eq("id", project_id)
    .maybeSingle();

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
      `/projects/${project_id}/settings?error=${encodeURIComponent("Email failed: " + (e as Error).message)}`
    );
  }

  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "invitation.resent",
    target_type: "invitation",
    target_id: invitation_id,
    metadata: { email: invite.email },
  });

  invalidateProject(project_id);
  redirect(
    `/projects/${project_id}/settings?success=Invitation+resent+to+${encodeURIComponent(invite.email)}`
  );
}

export async function cancelInvitation(formData: FormData) {
  const invitation_id = formData.get("invitation_id") as string;
  const project_id = formData.get("project_id") as string;
  if (!invitation_id || !project_id) {
    redirect(`/projects/${project_id}/settings?error=Missing+data`);
  }

  const { user } = await requireOwnerOrAdmin(project_id);

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invitations")
    .select("email")
    .eq("id", invitation_id)
    .maybeSingle();

  const { error } = await admin
    .from("invitations")
    .delete()
    .eq("id", invitation_id);

  if (error) {
    redirect(
      `/projects/${project_id}/settings?error=${encodeURIComponent("Cancel failed: " + error.message)}`
    );
  }

  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "invitation.cancelled",
    target_type: "invitation",
    target_id: invitation_id,
    metadata: { email: invite?.email },
  });

  invalidateProject(project_id);
  redirect(`/projects/${project_id}/settings?success=Invitation+cancelled`);
}
