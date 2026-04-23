"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInvitationEmail } from "@/lib/email/send-invitation";
import { redirect } from "next/navigation";
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

  redirect(`/projects/${id}/settings?success=Project+updated`);
}

export async function archiveProject(formData: FormData) {
  const id = formData.get("id") as string;
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

  redirect(`/projects/${id}/settings?success=Project+archived`);
}

export async function unarchiveProject(formData: FormData) {
  const id = formData.get("id") as string;
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

  redirect(`/projects/${id}/settings?success=Project+unarchived`);
}

export async function addMember(formData: FormData) {
  const project_id = formData.get("project_id") as string;
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const full_name = (formData.get("full_name") as string)?.trim();
  const role = formData.get("role") as "student" | "partner";
  const organization = (formData.get("organization") as string)?.trim() || null;

  if (!project_id || !email || !full_name || !role) {
    redirect(`/projects/${project_id}/settings?error=All+fields+required`);
  }

  const { user, profile, project } = await requireOwnerOrAdmin(project_id);

  const admin = createAdminClient();

  // Does a user with this email already exist?
  const { data: existingUser } = await admin
    .from("users")
    .select("id, role")
    .eq("email", email)
    .maybeSingle();

  if (existingUser) {
    // Are they already a member?
    const { data: existingMember } = await admin
      .from("project_members")
      .select("project_id")
      .eq("project_id", project_id)
      .eq("user_id", existingUser.id)
      .is("left_at", null)
      .maybeSingle();

    if (existingMember) {
      redirect(
        `/projects/${project_id}/settings?error=${encodeURIComponent(email + " is already a member")}`
      );
    }

    const { error } = await admin.from("project_members").insert({
      project_id,
      user_id: existingUser.id,
      project_role: "member",
      added_by: user.id,
    });

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
      metadata: { added_user: existingUser.id, email },
    });

    redirect(`/projects/${project_id}/settings?success=Added+${encodeURIComponent(email)}`);
  }

  // User doesn't exist — create invitation scoped to this project
  const token = crypto.randomBytes(32).toString("hex");
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Use regular client so RLS applies (invited_by = auth.uid())
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

  // Get the school name and project name for the email
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

  redirect(
    `/projects/${project_id}/settings?success=Invitation+sent+to+${encodeURIComponent(email)}`
  );
}

export async function removeMember(formData: FormData) {
  const project_id = formData.get("project_id") as string;
  const user_id = formData.get("user_id") as string;
  const { user } = await requireOwnerOrAdmin(project_id);

  const admin = createAdminClient();

  // Soft-remove by setting left_at
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

  redirect(`/projects/${project_id}/settings?success=Member+removed`);
}
