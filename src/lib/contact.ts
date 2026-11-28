import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80, "Keep your name under 80 characters."),
  email: z.string().trim().toLowerCase().email("Enter an email like name@company.com.").max(200),
  message: z
    .string()
    .trim()
    .min(10, "Write at least a sentence so I know what you need.")
    .max(2000, "Keep your message under 2,000 characters."),
  // Honeypot field. Real visitors never see it, so it should always be empty.
  website: z.string().max(200).optional().default(""),
});

export type ContactInput = z.infer<typeof contactSchema>;

export interface ContactMessage {
  name: string;
  email: string;
  message: string;
  createdAt: Date;
  ipHash: string;
  userAgent: string;
  emailed: boolean;
}

/**
 * Secret salt for visitor hashes. A known salt would let anyone hash every IPv4 address
 * and reverse the stored hashes, so production refuses to run without one.
 */
export function getIpHashSalt(): string {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("IP_HASH_SALT is not set in production");
    }
    return "portfolio";
  }
  return salt;
}

/** Hash the client IP so we can rate-limit without storing raw addresses. */
export function hashIp(ip: string): string {
  const salt = getIpHashSalt();
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Sends a notification through Resend's REST API when it's configured.
 * Returns false (never throws) so a mail outage doesn't lose the saved message.
 */
export async function notifyByEmail(input: ContactInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!apiKey || !to || !from) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: input.email,
        subject: `Portfolio message from ${input.name}`,
        text: `${input.message}\n\n— ${input.name} <${input.email}>`,
        html: `<p>${escapeHtml(input.message).replace(/\n/g, "<br>")}</p><p>— ${escapeHtml(input.name)} &lt;${escapeHtml(input.email)}&gt;</p>`,
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
