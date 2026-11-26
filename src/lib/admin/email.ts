import "server-only";
import type { AdminRole } from "./permissions";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function sendResendEmail(payload: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!apiKey || !from) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("Resend responded", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.error("Resend request failed", err);
    return false;
  }
}

export async function sendLoginCodeEmail(
  to: string,
  code: string,
  meta: { at: Date; location: string },
): Promise<boolean> {
  const timeStr = meta.at.toUTCString();
  const locStr = meta.location || "Unknown location";
  return sendResendEmail({
    to,
    subject: "Your admin sign-in code",
    text: `Your sign-in code is: ${code}\n\nIt expires in 10 minutes.\nTime: ${timeStr}\nApproximate location: ${locStr}\n\nIf you didn't try to sign in, change your password immediately.`,
    html: `<p>Your sign-in code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px;font-family:monospace">${escapeHtml(code)}</p><p>It expires in 10 minutes.</p><p style="color:#63636b;font-size:13px">Time: ${escapeHtml(timeStr)}<br>Approximate location: ${escapeHtml(locStr)}</p><p style="color:#63636b;font-size:13px">If you didn't try to sign in, change your password immediately.</p>`,
  });
}

export async function sendInviteEmail(
  to: string,
  inviteUrl: string,
  role: AdminRole,
  invitedByName: string,
): Promise<boolean> {
  return sendResendEmail({
    to,
    subject: "You're invited to Portfolio Admin",
    text: `${invitedByName} invited you to Portfolio Admin as ${role}.\n\nAccept your invite within 48 hours:\n${inviteUrl}`,
    html: `<p><strong>${escapeHtml(invitedByName)}</strong> invited you to Portfolio Admin as <strong>${escapeHtml(role)}</strong>.</p><p>Accept your invite within 48 hours:</p><p><a href="${escapeHtml(inviteUrl)}">${escapeHtml(inviteUrl)}</a></p>`,
  });
}

export async function sendNewDeviceEmail(
  to: string,
  meta: { at: Date; location: string; userAgent: string },
): Promise<boolean> {
  const timeStr = meta.at.toUTCString();
  const locStr = meta.location || "Unknown location";
  const uaStr = meta.userAgent || "Unknown device";
  return sendResendEmail({
    to,
    subject: "New device signed in to Portfolio Admin",
    text: `A new device signed in to your admin account.\n\nTime: ${timeStr}\nLocation: ${locStr}\nDevice: ${uaStr}\n\nIf this wasn't you, sign out all devices and change your password immediately.`,
    html: `<p>A new device signed in to your admin account.</p><p style="color:#63636b;font-size:13px">Time: ${escapeHtml(timeStr)}<br>Location: ${escapeHtml(locStr)}<br>Device: ${escapeHtml(uaStr)}</p><p>If this wasn't you, sign out all devices and change your password immediately.</p>`,
  });
}
