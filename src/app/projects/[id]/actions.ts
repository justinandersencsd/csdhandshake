"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkMessage, flagLabel, type FilterResult } from "@/lib/content-filter";
import { sendFlagAlert } from "@/lib/email/send-flag-alert";
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

  if (!project_id || !body) return { error: "Message cannot be empty." };

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

  // URL + email allowlists from env
  const urlAllowlist = (process.env.URL_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const emailAllowlist = (process.env.EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Content filter
  const check: FilterResult = checkMessage(body, { urlAllowlist, emailAllowlist });

  if (!check.ok && check.hardBlock) {
    // Log flag, possibly alert admins
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
      metadata: {
        flag_type: check.hardBlock.type,
        match: check.hardBlock.match,
      },
    });

    // Check repeated blocks in last 24h
    const twentyFourHoursAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();
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
      blocked: {
        type: flagLabel(check.hardBlock.type),
        match: check.hardBlock.match,
      },
    };
  }

  if (check.softWarn && !confirmed) {
    return {
      needsConfirm: true,
      softWarn: {
        type: flagLabel(check.softWarn.type),
        match: check.softWarn.match,
      },
    };
  }

  // Quiet hours (partners only)
  if (profile.role === "partner" && project.quiet_hours_enabled) {
    const { data: school } = await supabase
      .from("schools")
      .select("timezone")
      .eq("id", project.school_id)
      .maybeSingle();
    const tz = school?.timezone ?? "America/Denver";
    if (isInQuietHours(tz, project.quiet_hours_start, project.quiet_hours_end)) {
      return {
        error: `Messages to students are paused right now (${project.quiet_hours_start?.slice(0, 5) ?? ""}–${project.quiet_hours_end?.slice(0, 5) ?? ""}). Please try again later.`,
      };
    }
  }

  // Rate limit (partners only)
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

  // First-message review (partners only)
  let pendingReview = false;
  if (profile.role === "partner" && project.first_message_review_enabled) {
    const { data: membership } = await supabase
      .from("project_members")
      .select("first_message_reviewed, first_message_reviewed_count")
      .eq("project_id", project_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membership && !membership.first_message_reviewed) {
      pendingReview = true;
    }
  }

  // Insert message
  const { data: inserted, error: insertError } = await supabase
    .from("messages")
    .insert({
      project_id,
      sender_id: user.id,
      body,
      link_url,
      pending_review: pendingReview,
    })
    .select("id")
    .single();

  if (insertError) {
    return { error: "Failed to send: " + insertError.message };
  }

  // If soft warn & sent, also record the flag (non-blocking, pending review)
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

  // Audit: sent
  {
    const admin = createAdminClient();
    await admin.from("audit_events").insert({
      user_id: user.id,
      event_type: "message.sent",
      target_type: "message",
      target_id: inserted.id,
      metadata: { project_id, pending_review: pendingReview },
    });
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Re-check content filter on edit
  const urlAllowlist = (process.env.URL_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const emailAllowlist = (process.env.EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const check = checkMessage(body, { urlAllowlist, emailAllowlist });
  if (!check.ok && check.hardBlock) {
    return {
      error: `Edit blocked (${flagLabel(check.hardBlock.type)}).`,
    };
  }

  const { error } = await supabase
    .from("messages")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", id)
    .eq("sender_id", user.id);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${project_id}`);
  return { ok: true };
}

export async function deleteMessage(formData: FormData) {
  const id = formData.get("id") as string;
  const project_id = formData.get("project_id") as string;
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const admin = createAdminClient();
  const { error } = await admin.from("message_reports").insert({
    message_id,
    project_id,
    reporter_id: user.id,
    reason,
    status: "pending",
  });
  if (error) return { error: error.message };

  await admin.from("audit_events").insert({
    user_id: user.id,
    event_type: "message.reported",
    target_type: "message",
    target_id: message_id,
    metadata: { project_id, reason },
  });

  // Email project teachers + admins
  try {
    const { data: project } = await admin
      .from("projects")
      .select("id, name, school_id")
      .eq("id", project_id)
      .maybeSingle();

    const { data: message } = await admin
      .from("messages")
      .select("body, sender:users!sender_id(full_name, role)")
      .eq("id", message_id)
      .maybeSingle();

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get the message to know sender
  const { data: msg } = await supabase
    .from("messages")
    .select("sender_id, project_id")
    .eq("id", id)
    .maybeSingle();
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

  // Increment the sender's first_message_reviewed_count
  const { data: member } = await admin
    .from("project_members")
    .select("first_message_reviewed_count")
    .eq("project_id", msg.project_id)
    .eq("user_id", msg.sender_id)
    .maybeSingle();

  const { data: project } = await admin
    .from("projects")
    .select("first_message_review_count")
    .eq("id", msg.project_id)
    .maybeSingle();

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

  revalidatePath(`/projects/${project_id}`);
  return { ok: true };
}

// --- helpers ---

function isInQuietHours(
  timezone: string,
  start: string | null,
  end: string | null
): boolean {
  if (!start || !end) return false;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
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
  if (startMin < endMin) {
    return nowMin >= startMin && nowMin < endMin;
  } else {
    // Overnight window (e.g., 20:00–08:00)
    return nowMin >= startMin || nowMin < endMin;
  }
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
