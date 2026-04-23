"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("users")
    .select("id, role, school_id")
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

export async function escalateFlag(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;
  const { user } = await requireAdmin();

  const admin = createAdminClient();
  await admin
    .from("content_flags")
    .update({
      status: "escalated",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "flag.escalated",
    target_type: "content_flag",
    target_id: id,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/flags");
}

export async function resolveReport(formData: FormData) {
  const id = formData.get("id") as string;
  const action = formData.get("action") as "dismiss" | "escalate";
  if (!id) return;
  const { user } = await requireAdmin();

  const admin = createAdminClient();
  await admin
    .from("message_reports")
    .update({
      status: action === "dismiss" ? "dismissed" : "escalated",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: action === "dismiss" ? "report.dismissed" : "report.escalated",
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
