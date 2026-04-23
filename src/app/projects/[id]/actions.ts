"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function sendMessage(
  projectId: string,
  formData: FormData
): Promise<{ error?: string } | void> {
  const body = (formData.get("body") as string)?.trim();
  const attachment_url = (formData.get("attachment_url") as string)?.trim() || null;
  const attachment_label = (formData.get("attachment_label") as string)?.trim() || null;

  if (!body) {
    return { error: "Message can't be empty" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not signed in" };

  // Verify the user is a member (RLS on insert requires this anyway)
  const { data: membership } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .is("left_at", null)
    .maybeSingle();

  if (!membership) {
    return { error: "You are not a member of this project" };
  }

  // Check project is active
  const { data: project } = await supabase
    .from("projects")
    .select("status")
    .eq("id", projectId)
    .single();

  if (project?.status === "archived") {
    return { error: "This project is archived" };
  }

  const { error } = await supabase.from("messages").insert({
    project_id: projectId,
    sender_id: user.id,
    body,
    attachment_url,
    attachment_label,
    pending_review: false,
  });

  if (error) {
    return { error: "Failed to send message: " + error.message };
  }

  // Bump project updated_at so it moves to top of project list
  const admin = createAdminClient();
  await admin
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", projectId);

  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "message.sent",
    target_type: "project",
    target_id: projectId,
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

export async function editMessage(
  projectId: string,
  messageId: string,
  formData: FormData
): Promise<{ error?: string } | void> {
  const body = (formData.get("body") as string)?.trim();
  if (!body) return { error: "Message can't be empty" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // Get the message
  const { data: message } = await supabase
    .from("messages")
    .select("sender_id, created_at, deleted_at")
    .eq("id", messageId)
    .single();

  if (!message) return { error: "Message not found" };
  if (message.sender_id !== user.id) return { error: "Not your message" };
  if (message.deleted_at) return { error: "Message has been deleted" };

  // Enforce 5-minute window on the server
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  if (new Date(message.created_at).getTime() < fiveMinAgo) {
    return { error: "Edit window has expired (5 minutes)" };
  }

  // The db trigger 'log_message_edit' will copy the old body into message_edits and set edited_at
  const { error } = await supabase
    .from("messages")
    .update({ body })
    .eq("id", messageId);

  if (error) return { error: "Failed to edit: " + error.message };

  const admin = createAdminClient();
  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "message.edited",
    target_type: "message",
    target_id: messageId,
    metadata: { project_id: projectId },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function deleteMessage(
  projectId: string,
  messageId: string
): Promise<{ error?: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: message } = await supabase
    .from("messages")
    .select("sender_id, deleted_at")
    .eq("id", messageId)
    .single();

  if (!message) return { error: "Message not found" };
  if (message.sender_id !== user.id) return { error: "Not your message" };
  if (message.deleted_at) return { error: "Already deleted" };

  const { error } = await supabase
    .from("messages")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
    })
    .eq("id", messageId);

  if (error) return { error: "Failed to delete: " + error.message };

  const admin = createAdminClient();
  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "message.deleted",
    target_type: "message",
    target_id: messageId,
    metadata: { project_id: projectId },
  });

  revalidatePath(`/projects/${projectId}`);
}
