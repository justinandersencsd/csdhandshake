"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkMessage, flagLabel, type FilterResult } from "@/lib/content-filter";
import { sendFlagAlert } from "@/lib/email/send-flag-alert";
import { sendNewMessageEmail } from "@/lib/email/send-new-message";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

type SendResult =
  | { error: string; blocked?: { type: string; match: string } }
  | { needsConfirm: true; softWarn: { type: string; match: string } }
  | { ok: true };

export async function sendMessage(formData: FormData): Promise<SendResult> {
  const project_id = formData.get("project_id") as string;
  const body = ((formData.get("body") as string) ?? "").trim();
  const link_url = ((formData.get("link_url") as string) ?? "").trim() || null;
  const confirmed = formData.get("confirmed_send") === "true";

  const attachment_path = ((formData.get("attachment_path") as string) ?? "").trim() || null;
  const attachment_name = ((formData.get("attachment_name") as string) ?? "").trim() || null;
  const attachment_size_raw = formData.get("attachment_size") as string | null;
  const attachment_size = attachment_size_raw ? parseInt(attachment_size_raw, 10) : null;
  const attachment_mime = ((formData.get("attachment_mime") as string) ?? "").trim() || null;

  if (!project_id) return { error: "Missing project." };
  if (!body && !attachment_path) return { error: "Write something or attach a file." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: profile } = await supabase
    .from("users")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "Profile not found." };

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, school_id, status, first_message_review_enabled, first_message_review_count, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, rate_limit_enabled, rate_limit_per_hour"
    )
    .eq("id", project_id)
    .maybeSingle();
  if (!project) return { error: "Project not found." };
  if (project.status !== "active") return { error: "This project is archived." };

  const urlAllowlist = (process.env.URL_ALLOWLIST ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const emailAllowlist = (process.env.EMAIL_ALLOWLIST ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);

  // Run content filter on body only (attachments aren't text-scanned)
  const check: FilterResult = body
    ? checkMessage(body, { urlAllowlist, emailAllowlist })
    : { ok: true };

  if (!check.ok && check.hardBlock) {
    const admin = createAdminClient();
    await admin.from("content_flags").insert({
      project_id,
      sender_id: user.id,
      flag_type: check.hardBlock.type,
      matched_text: check.hardBlock.match,
      was_blocked: true,
      status: "pending",
    });

    await admin.from("audit_events").insert({
      user_id: user.id,
      event_type: "message.blocked",
      target_type: "project",
      target_id: project_id,
      metadata: { flag_type: check.hardBlock.type, match: check.hardBlock.match },
    });

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("content_flags")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", user.id)
      .eq("was_blocked", true)
      .gte("created_at", twentyFourHoursAgo);

    if ((count ?? 0) >= 3) {
      try {
        await alertAdmins({
          schoolId: project.school_id,
          senderName: profile.full_name,
          senderRole: profile.role,
          projectName: project.name,
          projectId: project_id,
          flagType: flagLabel(check.hardBlock.type),
          matchedText: check.hardBlock.match,
          wasBlocked: true,
          repeatedBlocks: count ?? 0,
        });
      } catch (e) {
        console.error("Flag alert failed", e);
      }
    }

    return {
      error: `This message was blocked (${flagLabel(check.hardBlock.type)}).`,
      blocked: { type: flagLabel(check.hardBlock.type), match: check.hardBlock.match },
    };
  }

  if (check.softWarn && !confirmed) {
    return {
      needsConfirm: true,
      softWarn: { type: flagLabel(check.softWarn.type), match: check.softWarn.match },
    };
  }

  if (profile.role === "partner" && project.quiet_hours_enabled) {
    const { data: school } = await supabase
      .from("schools").select("timezone").eq("id", project.school_id).maybeSingle();
    const tz = school?.timezone ?? "America/Denver";
    if (isInQuietHours(tz, project.quiet_hours_start, project.quiet_hours_end)) {
      return {
        error: `Messages to students are paused right now (${project.quiet_hours_start?.slice(0,5) ?? ""}–${project.quiet_hours_end?.slice(0,5) ?? ""}). Please try again later.`,
      };
    }
  }

  if (profile.role === "partner" && project.rate_limit_enabled) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project_id)
      .eq("sender_id", user.id)
      .is("deleted_at", null)
      .gte("created_at", oneHourAgo);
    const limit = project.rate_limit_per_hour ?? 10;
    if ((recentCount ?? 0) >= limit) {
      return {
        error: `You've reached the hourly message limit (${limit}). Please wait before sending more.`,
      };
    }
  }

  let pendingReview = false;
  if (profile.role === "partner" && project.first_message_review_enabled) {
    const { data: membership } = await supabase
      .from("project_members")
      .select("first_message_reviewed")
      .eq("project_id", project_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membership && !membership.first_message_reviewed) {
      pendingReview = true;
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("messages")
    .insert({
      project_id,
      sender_id: user.id,
      body,
      link_url,
      attachment_path,
      attachment_name,
      attachment_size,
      attachment_mime,
      pending_review: pendingReview,
    })
    .select("id")
    .single();

  if (insertError) return { error: "Failed to send: " + insertError.message };

  if (check.softWarn && confirmed) {
    const admin = createAdminClient();
    await admin.from("content_flags").insert({
      project_id,
      message_id: inserted.id,
      sender_id: user.id,
      flag_type: check.softWarn.type,
      matched_text: check.softWarn.match,
      was_blocked: false,
      status: "pending",
    });
    await admin.from("audit_events").insert({
      user_id: user.id,
      event_type: "message.flagged_soft",
      target_type: "message",
      target_id: inserted.id,
      metadata: { flag_type: check.softWarn.type, match: check.softWarn.match },
    });
  }

  {
    const admin = createAdminClient();
    await admin.from("audit_events").insert({
      user_id: user.id,
      event_type: "message.sent",
      target_type: "message",
      target_id: inserted.id,
      metadata: { project_id, pending_review: pendingReview, has_attachment: !!attachment_path },
    });
  }

  if (!pendingReview) {
    try {
      await notifyMembers({
        projectId: project_id,
        projectName: project.name,
        senderId: user.id,
        senderName: profile.full_name,
        senderRole: profile.role,
        body: body || `(shared an attachment: ${attachment_name})`,
      });
    } catch (e) {
      console.error("Notification failed", e);
    }
  }

  revalidatePath(`/projects/${project_id}`);
  revalidatePath("/");
  return { ok: true };
}

export async function editMessage(formData: FormData) {
  const id = formData.get("id") as string;
  const project_id = formData.get("project_id") as string;
  const body = ((formData.get("body") as string) ?? "").trim();
  if (!id || !body) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const urlAllowlist = (process.env.URL_ALLOWLIST ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const emailAllowlist = (process.env.EMAIL_ALLOWLIST ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const check = checkMessage(body, { urlAllowlist, emailAllowlist });
  if (!check.ok && check.hardBlock) {
    return { error: `Edit blocked (${flagLabel(check.hardBlock.type)}).` };
  }

  const { error } = await supabase
    .from("messages")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", id).eq("sender_id", user.id);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${project_id}`);
  return { ok: true };
}

export async function deleteMessage(formData: FormData) {
  const id = formData.get("id") as string;
  const project_id = formData.get("project_id") as string;
  if (!id) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("messages")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", id);

  revalidatePath(`/projects/${project_id}`);
  return { ok: true };
}

export async function reportMessage(formData: FormData) {
  const project_id = formData.get("project_id") as string;
  const message_id = formData.get("message_id") as string;
  const reason = ((formData.get("reason") as string) ?? "").trim() || null;
  if (!project_id || !message_id) return { error: "Missing data." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const admin = createAdminClient();
  const { error } = await admin.from("message_reports").insert({
    message_id, project_id, reporter_id: user.id, reason, status: "pending",
  });
  if (error) return { error: error.message };

  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "message.reported",
    target_type: "message",
    target_id: message_id,
    metadata: { project_id, reason },
  });

  try {
    const { data: project } = await admin
      .from("projects").select("id, name, school_id").eq("id", project_id).maybeSingle();
    const { data: message } = await admin
      .from("messages")
      .select("body, sender:users!sender_id(full_name, role)")
      .eq("id", message_id).maybeSingle();
    if (project && message) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sender = message.sender as any;
      await alertAdmins({
        schoolId: project.school_id,
        senderName: sender?.full_name ?? "Unknown",
        senderRole: sender?.role ?? "unknown",
        projectName: project.name,
        projectId: project_id,
        flagType: "user report",
        matchedText: reason || message.body.slice(0, 200),
        wasBlocked: false,
      });
    }
  } catch (e) {
    console.error("Report alert failed", e);
  }

  revalidatePath(`/projects/${project_id}`);
  return { ok: true };
}

export async function approveMessage(formData: FormData) {
  const id = formData.get("id") as string;
  const project_id = formData.get("project_id") as string;
  if (!id) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: msg } = await supabase
    .from("messages").select("sender_id, project_id, body, attachment_name").eq("id", id).maybeSingle();
  if (!msg) return;

  const admin = createAdminClient();
  await admin
    .from("messages")
    .update({
      pending_review: false,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", id);

  const { data: member } = await admin
    .from("project_members")
    .select("first_message_reviewed_count")
    .eq("project_id", msg.project_id)
    .eq("user_id", msg.sender_id)
    .maybeSingle();

  const { data: project } = await admin
    .from("projects").select("first_message_review_count, name")
    .eq("id", msg.project_id).maybeSingle();

  const newCount = (member?.first_message_reviewed_count ?? 0) + 1;
  const threshold = project?.first_message_review_count ?? 3;
  const done = newCount >= threshold;

  await admin
    .from("project_members")
    .update({
      first_message_reviewed_count: newCount,
      first_message_reviewed: done,
    })
    .eq("project_id", msg.project_id)
    .eq("user_id", msg.sender_id);

  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "message.approved",
    target_type: "message",
    target_id: id,
    metadata: { project_id },
  });

  try {
    const { data: sender } = await admin
      .from("users").select("full_name, role").eq("id", msg.sender_id).maybeSingle();
    if (sender && project) {
      await notifyMembers({
        projectId: msg.project_id,
        projectName: project.name,
        senderId: msg.sender_id,
        senderName: sender.full_name,
        senderRole: sender.role,
        body: msg.body || `(shared an attachment: ${msg.attachment_name})`,
      });
    }
  } catch (e) {
    console.error("Post-approve notify failed", e);
  }

  revalidatePath(`/projects/${project_id}`);
  return { ok: true };
}

export async function markAsRead(projectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  await admin.from("message_reads").upsert(
    {
      user_id: user.id,
      project_id: projectId,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "user_id,project_id" }
  );

  revalidatePath("/");
  revalidatePath(`/projects/${projectId}`);
}

/** Return a signed URL for an attachment. Caller is a project member (checked via RLS). */
export async function getAttachmentUrl(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Verify membership via the attachment path's project_id prefix
  const projectId = path.split("/")[0];
  if (!projectId) return null;

  const { data: member } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .is("left_at", null)
    .maybeSingle();

  // Admins can bypass membership check
  const { data: profile } = await supabase
    .from("users").select("role, school_id").eq("id", user.id).maybeSingle();
  const isAdmin =
    profile?.role === "district_admin" ||
    (profile?.role === "school_admin"); // school admin check via project.school_id could be tighter

  if (!member && !isAdmin) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("attachments")
    .createSignedUrl(path, 60 * 60); // 1 hour

  if (error || !data) return null;
  return data.signedUrl;
}

// --- helpers ---

function isInQuietHours(
  timezone: string,
  start: string | null,
  end: string | null
): boolean {
  if (!start || !end) return false;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, hour12: false, hour: "2-digit", minute: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  const nowMin = parseInt(hh) * 60 + parseInt(mm);
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (startMin === endMin) return false;
  if (startMin < endMin) return nowMin >= startMin && nowMin < endMin;
  return nowMin >= startMin || nowMin < endMin;
}

async function alertAdmins(p: {
  schoolId: string;
  senderName: string;
  senderRole: string;
  projectName: string;
  projectId: string;
  flagType: string;
  matchedText: string;
  wasBlocked: boolean;
  repeatedBlocks?: number;
}) {
  const admin = createAdminClient();
  const { data: recipients } = await admin
    .from("users")
    .select("email, role, notification_prefs")
    .or(`role.eq.district_admin,and(role.eq.school_admin,school_id.eq.${p.schoolId})`);

  const toEmails = (recipients ?? [])
    .filter((r) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prefs = (r.notification_prefs as any) ?? {};
      return prefs.email_flags_only !== false;
    })
    .map((r) => r.email);

  if (toEmails.length === 0) return;

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  await sendFlagAlert({
    to: toEmails,
    senderName: p.senderName,
    senderRole: p.senderRole,
    projectName: p.projectName,
    flagType: p.flagType,
    matchedText: p.matchedText,
    wasBlocked: p.wasBlocked,
    reviewUrl: `${appUrl}/projects/${p.projectId}`,
    repeatedBlocks: p.repeatedBlocks,
  });
}

async function notifyMembers(p: {
  projectId: string;
  projectName: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  body: string;
}) {
  const admin = createAdminClient();

  const { data: members } = await admin
    .from("project_members")
    .select("user_id, user:users!user_id(email, full_name, notification_prefs)")
    .eq("project_id", p.projectId)
    .is("left_at", null);

  if (!members) return;

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  for (const m of members) {
    if (m.user_id === p.senderId) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = m.user as any;
    if (!u?.email) continue;

    const prefs = u.notification_prefs ?? {};
    const freq = prefs.email_frequency ?? "immediate";
    if (freq !== "immediate") continue;

    const { data: recent } = await admin
      .from("email_log")
      .select("id")
      .eq("recipient_id", m.user_id)
      .eq("project_id", p.projectId)
      .eq("kind", "new_message")
      .gte("sent_at", fiveMinAgo)
      .limit(1);
    if (recent && recent.length > 0) continue;

    try {
      await sendNewMessageEmail({
        to: u.email,
        recipientName: u.full_name,
        senderName: p.senderName,
        senderRole: p.senderRole,
        projectName: p.projectName,
        messageBody: p.body,
        projectUrl: `${appUrl}/projects/${p.projectId}`,
      });

      await admin.from("email_log").insert({
        recipient_id: m.user_id,
        project_id: p.projectId,
        kind: "new_message",
      });
    } catch (e) {
      console.error("Email to", u.email, "failed:", e);
    }
  }
}
