import { Resend } from "resend";

type DigestProject = {
  name: string;
  unreadCount: number;
  latestSender: string;
  latestSnippet: string;
};

type DigestParams = {
  to: string;
  recipientName: string;
  projects: DigestProject[];
};

let _resend: Resend | null = null;
function resend() {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    _resend = new Resend(key);
  }
  return _resend;
}

export async function sendDailyDigest(p: DigestParams) {
  const from = process.env.RESEND_FROM_EMAIL || "noreply@csdtvstaff.org";
  const district = process.env.DISTRICT_NAME || "Canyons School District";
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  const totalUnread = p.projects.reduce((sum, pr) => sum + pr.unreadCount, 0);

  const projectBlocks = p.projects
    .map(
      (pr) => `
    <div style="padding:12px 16px;border:1px solid #c2ccda;border-radius:6px;margin-bottom:8px;">
      <div style="font-size:15px;font-weight:500;color:#162844;">
        ${escapeHtml(pr.name)} <span style="color:#585555;font-weight:400;">· ${pr.unreadCount} new</span>
      </div>
      <div style="font-size:13px;color:#585555;margin-top:4px;">
        <strong>${escapeHtml(pr.latestSender)}:</strong> ${escapeHtml(pr.latestSnippet)}
      </div>
    </div>`
    )
    .join("");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#162844;">
      <h2 style="margin:0 0 8px 0;font-size:20px;font-weight:500;">Your ${district} Handshake summary</h2>
      <p style="color:#585555;font-size:14px;margin:0 0 20px 0;">
        ${totalUnread} new ${totalUnread === 1 ? "message" : "messages"} across ${p.projects.length} ${p.projects.length === 1 ? "project" : "projects"}.
      </p>

      ${projectBlocks}

      <p style="margin-top:24px;">
        <a href="${appUrl}" style="display:inline-block;background:#162844;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Open Handshake</a>
      </p>

      <p style="color:#585555;font-size:12px;margin-top:32px;">
        You're getting the daily digest. <a href="${appUrl}/settings" style="color:#585555;">Change preferences</a>.
      </p>
    </div>
  `;

  await resend().emails.send({
    from,
    to: p.to,
    subject: `[${district} Handshake] Your daily summary — ${totalUnread} new ${totalUnread === 1 ? "message" : "messages"}`,
    html,
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
