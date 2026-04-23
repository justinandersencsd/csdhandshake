import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDailyDigest } from "@/lib/email/send-daily-digest";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Vercel cron sends an Authorization header; optional but recommended
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Find all users who want daily digests
  const { data: users } = await admin
    .from("users")
    .select("id, email, full_name, notification_prefs")
    .is("deactivated_at", null);

  if (!users) return NextResponse.json({ sent: 0 });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const u of users) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prefs = (u.notification_prefs as any) ?? {};
    const freq = prefs.email_frequency ?? "immediate";
    if (freq !== "daily") {
      skipped++;
      continue;
    }

    // Find their projects
    const { data: memberships } = await admin
      .from("project_members")
      .select("project_id")
      .eq("user_id", u.id)
      .is("left_at", null);
    const projectIds = (memberships ?? []).map((m) => m.project_id);
    if (projectIds.length === 0) continue;

    // Get unread counts per project (last 24h, excluding sender's own)
    const digestProjects: {
      name: string;
      unreadCount: number;
      latestSender: string;
      latestSnippet: string;
    }[] = [];

    for (const projectId of projectIds) {
      const { data: project } = await admin
        .from("projects")
        .select("id, name")
        .eq("id", projectId)
        .eq("status", "active")
        .maybeSingle();
      if (!project) continue;

      // Last read for this user/project
      const { data: readRow } = await admin
        .from("message_reads")
        .select("last_read_at")
        .eq("user_id", u.id)
        .eq("project_id", projectId)
        .maybeSingle();
      const lastRead = readRow?.last_read_at ?? twentyFourHoursAgo;

      // Unread count (not self, not deleted, not pending, after lastRead, within 24h)
      const { count } = await admin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .is("pending_review", false)
        .neq("sender_id", u.id)
        .gt("created_at", lastRead);

      if (!count || count === 0) continue;

      // Most recent message preview
      const { data: latest } = await admin
        .from("messages")
        .select("body, sender:users!sender_id(full_name)")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .is("pending_review", false)
        .neq("sender_id", u.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latest) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sender = latest.sender as any;
      digestProjects.push({
        name: project.name,
        unreadCount: count,
        latestSender: sender?.full_name ?? "Someone",
        latestSnippet:
          latest.body.length > 120 ? latest.body.slice(0, 120) + "…" : latest.body,
      });
    }

    if (digestProjects.length === 0) continue;

    try {
      await sendDailyDigest({
        to: u.email,
        recipientName: u.full_name,
        projects: digestProjects,
      });
      await admin.from("email_log").insert({
        recipient_id: u.id,
        project_id: null,
        kind: "daily_digest",
      });
      sent++;
    } catch (e) {
      errors.push(`${u.email}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ sent, skipped, errors });
}
