"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export async function createProject(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const partner_organization =
    (formData.get("partner_organization") as string)?.trim() || null;
  const school_id = formData.get("school_id") as string;

  if (!name || !school_id) {
    redirect("/projects/new?error=Name+and+school+are+required");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["teacher", "school_admin", "district_admin"].includes(profile.role)) {
    redirect("/?error=Not+authorized");
  }

  // Create project via regular client (RLS allows teachers/admins)
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      name,
      description,
      partner_organization,
      school_id,
      created_by: user.id,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !project) {
    redirect(
      `/projects/new?error=${encodeURIComponent("Failed to create project: " + (error?.message ?? "unknown"))}`
    );
  }

  // Add creator as owner via admin client (bypasses RLS, since there's no insert policy on project_members)
  const admin = createAdminClient();
  const { error: memberError } = await admin.from("project_members").insert({
    project_id: project.id,
    user_id: user.id,
    project_role: "owner",
    added_by: user.id,
  });

  if (memberError) {
    // Try to clean up the project we just created
    await admin.from("projects").delete().eq("id", project.id);
    redirect(
      `/projects/new?error=${encodeURIComponent("Failed to add owner: " + memberError.message)}`
    );
  }

  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "project.created",
    target_type: "project",
    target_id: project.id,
    metadata: { name, school_id },
  });

  redirect(`/projects/${project.id}`);
}
