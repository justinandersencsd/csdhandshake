import { Resend } from "resend";

type FlagAlertParams = {
  to: string[]; // admin emails
  senderName: string;
  senderRole: string;
  projectName: string;
  flagType: string;
  matchedText: string;
  wasBlocked: boolean;
  reviewUrl: string;
  repeatedBlocks?: number; // if > 0, this is a repeated-blocks alert
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

export async function sendFlagAlert(p: FlagAlertParams) {
  const from = process.env.RESEND_FROM_EMAIL || "noreply@csdtvstaff.org";
  const district = process.env.DISTRICT_NAME || "Canyons School District";

  const isRepeated = (p.repeatedBlocks ?? 0) >= 3;

  const subject = isRepeated
    ? `[${district} Handshake] Repeated blocks: ${p.senderName}`
    : p.wasBlocked
      ? `[${district} Handshake] Blocked: ${p.flagType} from ${p.senderName}`
      : `[${district} Handshake] Flag for review: ${p.flagType}`;

  const header = isRepeated
    ? `<p><strong>${p.senderName}</strong> (${p.senderRole}) has had ${p.repeatedBlocks} messages blocked in the last 24 hours in <strong>${p.projectName}</strong>.</p>`
    : `<p><strong>${p.senderName}</strong> (${p.senderRole}) sent a message flagged as <strong>${p.flagType}</strong> in <strong>${p.projectName}</strong>.</p>`;

  const action = p.wasBlocked
    ? `<p>The message was <strong>blocked</strong> and never delivered.</p>`
    : `<p>The message was delivered but is awaiting moderator review.</p>`;

  const snippet = `<blockquote style="border-left:3px solid #c2ccda;padding-left:12px;color:#585555;margin:16px 0;">${escapeHtml(p.matchedText)}</blockquote>`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#162844;">
      <h2 style="margin:0 0 16px 0;font-size:20px;">Handshake — content alert</h2>
      ${header}
      ${action}
      ${snippet}
      <p><a href="${p.reviewUrl}" style="display:inline-block;background:#162844;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Open project</a></p>
      <p style="color:#585555;font-size:12px;margin-top:32px;">You are receiving this because you are a moderator for ${district} Handshake.</p>
    </div>
  `;

  await resend().emails.send({ from, to: p.to, subject, html });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
