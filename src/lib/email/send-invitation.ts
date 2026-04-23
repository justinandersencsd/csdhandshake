import { Resend } from "resend";

type InvitationEmailProps = {
  to: string;
  inviteeName: string;
  inviterName: string;
  schoolName: string;
  projectName?: string | null;
  token: string;
  role: "student" | "partner" | "teacher" | "school_admin" | "district_admin";
};

export async function sendInvitationEmail({
  to,
  inviteeName,
  inviterName,
  schoolName,
  projectName,
  token,
  role,
}: InvitationEmailProps) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const supportEmail = process.env.RESEND_FROM_EMAIL ?? "support@canyonsdistrict.org";
  const link = `${appUrl}/invite/${token}`;

  const contextLine = projectName
    ? `has invited you to work with students on a project called <strong>${projectName}</strong>`
    : `has invited you to join <strong>CSD Handshake</strong> as a ${role.replace("_", " ")}`;

  const subject = projectName
    ? `You've been invited to a student project: ${projectName}`
    : `You've been invited to CSD Handshake`;

  const partnerGuidelines = `
    <p>A few things to know before you get started:</p>
    <ul style="padding-left: 20px;">
      <li>All communication with students happens on this platform. No texting, email, or social media with students outside of it.</li>
      <li>Your messages are visible to the teacher and district administrators.</li>
      <li>You'll be asked to review and accept a short code of conduct the first time you log in.</li>
      <li>You'll only see the project you've been invited to.</li>
    </ul>
  `;

  const studentGuidelines = `
    <p>Before your first post, you'll review a short acceptable-use agreement.</p>
  `;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #162844; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
  <h1 style="color: #162844; font-size: 20px; font-weight: 500; margin: 0 0 16px;">CSD Handshake</h1>
  <p>Hi ${inviteeName},</p>
  <p><strong>${inviterName}</strong> at ${schoolName} ${contextLine}. You're being invited through <strong>CSD Handshake</strong> — Canyons School District's platform for all student–partner collaboration.</p>
  ${role === "partner" ? partnerGuidelines : role === "student" ? studentGuidelines : ""}
  <p style="margin: 24px 0;">
    <a href="${link}" style="background: #162844; color: #fefefe; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">Accept invitation</a>
  </p>
  <p style="font-size: 13px; color: #585555;">This invitation expires in 7 days. If you weren't expecting this, please reply to ${supportEmail} before accepting.</p>
</body>
</html>
  `.trim();

  const { data, error } = await resend.emails.send({
    from: `CSD Handshake <${process.env.RESEND_FROM_EMAIL}>`,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Failed to send invitation email: ${error.message}`);
  }

  return data;
}