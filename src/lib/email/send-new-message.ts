import { Resend } from "resend";

type NewMessageParams = {
  to: string;
  recipientName: string;
  senderName: string;
  senderRole: string;
  projectName: string;
  messageBody: string;
  projectUrl: string;
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

export async function sendNewMessageEmail(p: NewMessageParams) {
  const from = process.env.RESEND_FROM_EMAIL || "noreply@csdtvstaff.org";
  const district = process.env.DISTRICT_NAME || "Canyons School District";
  const snippet =
    p.messageBody.length > 200
      ? p.messageBody.slice(0, 200) + "…"
      : p.messageBody;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#162844;">
      <h2 style="margin:0 0 8px 0;font-size:20px;font-weight:500;">New message in ${escapeHtml(p.projectName)}</h2>
      <p style="color:#585555;font-size:14px;margin:0 0 20px 0;">
        ${escapeHtml(p.senderName)} sent a message:
      </p>
      <blockquote style="border-left:3px solid #c2ccda;padding:8px 16px;color:#162844;margin:0 0 20px 0;background:#F2F5FA;border-radius:4px;">
        ${escapeHtml(snippet)}
      </blockquote>
      <p><a href="${p.projectUrl}" style="display:inline-block;background:#162844;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">View conversation</a></p>
      <p style="color:#585555;font-size:12px;margin-top:32px;">
        ${district} Handshake · <a href="${process.env.APP_URL || "http://localhost:3000"}/settings" style="color:#585555;">notification preferences</a>
      </p>
    </div>
  `;

  await resend().emails.send({
    from,
    to: p.to,
    subject: `[${district} Handshake] New message from ${p.senderName} in ${p.projectName}`,
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
