"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clientIp, hashIp } from "@/lib/contact";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { NO_TRACK_COOKIE_NAME, noTrackCookieOptions } from "@/lib/visitor";
import { logAudit } from "./audit";
import {
  ADMINS_COLLECTION,
  CHALLENGE_COOKIE_NAME,
  CHALLENGE_TTL_MS,
  DEVICE_COOKIE_NAME,
  DEVICE_TTL_MS,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  acceptInvite,
  adminCookieOptions,
  createLoginChallenge,
  createSession,
  createTrustedDevice,
  ensureAdminIndexes,
  generateAndStoreBackupCodes,
  hasValidTrustedDevice,
  resendLoginChallenge,
  revokeSession,
  verifyAdminCredentials,
  verifyLoginChallengeCode,
  type AdminDoc,
} from "./auth";
import { hmacHash, maskEmail } from "./crypto";
import { sendLoginCodeEmail, sendNewDeviceEmail } from "./email";
import { consumeRateLimit } from "./rate-limit";

const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_MAX = 5;

export type LoginActionState =
  | { step: "credentials"; error: string | null }
  | {
      step: "code";
      maskedEmail: string;
      resendAvailableAt: string;
      error: string | null;
      notice?: string | null;
    }
  | {
      step: "backup_codes";
      codes: string[];
    };

export type InviteActionState = {
  error: string | null;
};

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  password: z.string().min(1, "Enter your password.").max(200),
});

const codeSchema = z.object({
  code: z.string().trim().min(1, "Enter the 6-digit code or a backup code.").max(32),
  trustDevice: z.string().optional(),
});

const acceptInviteSchema = z
  .object({
    token: z.string().min(10).max(200),
    name: z.string().trim().min(1, "Enter your name.").max(80, "Keep your name under 80 characters."),
    password: z.string().min(12, "Password must be at least 12 characters.").max(200),
    confirmPassword: z.string().min(1, "Confirm your password.").max(200),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

function decodeHeaderValue(val: string | null): string | null {
  if (!val) return null;
  try {
    return decodeURIComponent(val).slice(0, 80);
  } catch {
    return val.slice(0, 80);
  }
}

async function getRequestMeta() {
  const hdrs = await headers();
  const ip = clientIp(hdrs);
  const ipHash = hashIp(ip);
  const userAgent = (hdrs.get("user-agent") ?? "Unknown").slice(0, 300);
  const city = decodeHeaderValue(hdrs.get("x-vercel-ip-city"));
  const country = decodeHeaderValue(hdrs.get("x-vercel-ip-country"));
  const location = [city, country].filter(Boolean).join(", ") || "Unknown location";
  return { ipHash, userAgent, city, country, location };
}

export async function loginStepOneAction(
  _prev: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  if (!isMongoConfigured()) {
    return { step: "credentials", error: "Database is not configured." };
  }

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { step: "credentials", error: parsed.error.issues[0]?.message ?? "Invalid email or password." };
  }

  const db = await getDb();
  await ensureAdminIndexes(db);
  const meta = await getRequestMeta();

  const [ipOk, emailOk] = await Promise.all([
    consumeRateLimit(db, `admin-login:ip:${meta.ipHash}`, LOGIN_RATE_WINDOW_MS, LOGIN_RATE_MAX),
    consumeRateLimit(
      db,
      `admin-login:email:${hmacHash("rate", parsed.data.email)}`,
      LOGIN_RATE_WINDOW_MS,
      LOGIN_RATE_MAX,
    ),
  ]);
  if (!ipOk || !emailOk) {
    return { step: "credentials", error: "Too many sign-in attempts. Wait 15 minutes and try again." };
  }

  const admin = await verifyAdminCredentials(db, parsed.data.email, parsed.data.password);
  if (!admin) {
    return { step: "credentials", error: "Invalid email or password." };
  }

  const cookieStore = await cookies();
  const deviceToken = cookieStore.get(DEVICE_COOKIE_NAME)?.value;
  const trusted = await hasValidTrustedDevice(db, admin._id, deviceToken);

  if (trusted && admin.backupCodeHashes.length > 0) {
    const session = await createSession(db, admin._id, meta);
    cookieStore.set(
      SESSION_COOKIE_NAME,
      session.token,
      adminCookieOptions(Math.floor(SESSION_TTL_MS / 1000)),
    );
    cookieStore.set(NO_TRACK_COOKIE_NAME, "1", noTrackCookieOptions());
    await logAudit(db, admin, "auth.sign_in", admin.email, "Trusted device");
    redirect("/admin");
  }

  const challenge = await createLoginChallenge(db, admin._id);
  cookieStore.set(
    CHALLENGE_COOKIE_NAME,
    challenge.challengeId,
    adminCookieOptions(Math.floor(CHALLENGE_TTL_MS / 1000)),
  );

  await sendLoginCodeEmail(admin.email, challenge.code, {
    at: new Date(),
    location: meta.location,
  });

  return {
    step: "code",
    maskedEmail: maskEmail(admin.email),
    resendAvailableAt: challenge.resendAvailableAt.toISOString(),
    error: null,
  };
}

export async function verifyLoginCodeAction(
  prev: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  if (!isMongoConfigured()) {
    return { step: "credentials", error: "Database is not configured." };
  }

  const cookieStore = await cookies();
  const challengeId = cookieStore.get(CHALLENGE_COOKIE_NAME)?.value;
  if (!challengeId) {
    return { step: "credentials", error: "Sign-in session expired. Enter your email and password again." };
  }

  const parsed = codeSchema.safeParse({
    code: formData.get("code"),
    trustDevice: formData.get("trustDevice")?.toString(),
  });
  if (!parsed.success) {
    return {
      step: "code",
      maskedEmail: prev.step === "code" ? prev.maskedEmail : "***",
      resendAvailableAt: prev.step === "code" ? prev.resendAvailableAt : new Date().toISOString(),
      error: parsed.error.issues[0]?.message ?? "Enter your code.",
    };
  }

  const db = await getDb();
  await ensureAdminIndexes(db);
  const meta = await getRequestMeta();
  const rateOk = await consumeRateLimit(
    db,
    `admin-code:ip:${meta.ipHash}`,
    15 * 60 * 1000,
    20,
  );
  if (!rateOk) {
    return {
      step: "code",
      maskedEmail: prev.step === "code" ? prev.maskedEmail : "***",
      resendAvailableAt: prev.step === "code" ? prev.resendAvailableAt : new Date().toISOString(),
      error: "Too many attempts. Wait 15 minutes and try again.",
    };
  }

  const result = await verifyLoginChallengeCode(db, challengeId, parsed.data.code);

  if (!result.ok) {
    if (result.reason === "invalid_code") {
      return {
        step: "code",
        maskedEmail: prev.step === "code" ? prev.maskedEmail : "***",
        resendAvailableAt: prev.step === "code" ? prev.resendAvailableAt : new Date().toISOString(),
        error: "Invalid code. Check your email or use an unused backup code.",
      };
    }
    cookieStore.delete({ name: CHALLENGE_COOKIE_NAME, path: "/admin" });
    const msg =
      result.reason === "too_many_attempts"
        ? "Too many incorrect codes. Sign in again."
        : "Your sign-in code expired. Sign in again.";
    return { step: "credentials", error: msg };
  }

  cookieStore.delete({ name: CHALLENGE_COOKIE_NAME, path: "/admin" });
  const session = await createSession(db, result.admin._id, meta);
  cookieStore.set(
    SESSION_COOKIE_NAME,
    session.token,
    adminCookieOptions(Math.floor(SESSION_TTL_MS / 1000)),
  );
  cookieStore.set(NO_TRACK_COOKIE_NAME, "1", noTrackCookieOptions());

  const trustChecked = parsed.data.trustDevice === "on" || parsed.data.trustDevice === "true";
  if (trustChecked) {
    const device = await createTrustedDevice(db, result.admin._id, meta.userAgent);
    cookieStore.set(
      DEVICE_COOKIE_NAME,
      device.token,
      adminCookieOptions(Math.floor(DEVICE_TTL_MS / 1000)),
    );
    await sendNewDeviceEmail(result.admin.email, {
      at: new Date(),
      location: meta.location,
      userAgent: meta.userAgent,
    });
  }

  await logAudit(
    db,
    result.admin,
    "auth.sign_in",
    result.admin.email,
    result.usedBackupCode ? "Backup code" : trustChecked ? "2FA + trusted device" : "2FA code",
  );

  if (result.admin.backupCodeHashes.length === 0) {
    const codes = await generateAndStoreBackupCodes(db, result.admin._id);
    await logAudit(db, result.admin, "auth.backup_codes_generated", result.admin.email, "Initial setup");
    return { step: "backup_codes", codes };
  }

  redirect("/admin");
}

export async function resendCodeAction(prev: LoginActionState): Promise<LoginActionState> {
  if (!isMongoConfigured()) {
    return { step: "credentials", error: "Database is not configured." };
  }
  const cookieStore = await cookies();
  const challengeId = cookieStore.get(CHALLENGE_COOKIE_NAME)?.value;
  if (!challengeId) {
    return { step: "credentials", error: "Sign-in session expired. Sign in again." };
  }

  const db = await getDb();
  await ensureAdminIndexes(db);
  const res = await resendLoginChallenge(db, challengeId);
  if (!res.ok) {
    if (res.reason === "cooldown") {
      return {
        step: "code",
        maskedEmail: prev.step === "code" ? prev.maskedEmail : "***",
        resendAvailableAt: prev.step === "code" ? prev.resendAvailableAt : new Date().toISOString(),
        error: `Please wait ${res.retryAfterSec ?? 60}s before requesting a new code.`,
      };
    }
    cookieStore.delete({ name: CHALLENGE_COOKIE_NAME, path: "/admin" });
    const msg =
      res.reason === "resend_limit"
        ? "Too many codes requested. Sign in again."
        : "Sign-in session expired. Sign in again.";
    return { step: "credentials", error: msg };
  }

  const admin = await db.collection<AdminDoc>(ADMINS_COLLECTION).findOne({ _id: res.adminId });
  if (!admin || admin.disabledAt !== null) {
    cookieStore.delete({ name: CHALLENGE_COOKIE_NAME, path: "/admin" });
    return { step: "credentials", error: "Account unavailable." };
  }

  const meta = await getRequestMeta();
  await sendLoginCodeEmail(admin.email, res.code, { at: new Date(), location: meta.location });

  return {
    step: "code",
    maskedEmail: maskEmail(admin.email),
    resendAvailableAt: res.resendAvailableAt.toISOString(),
    error: null,
    notice: "A new 6-digit code has been sent.",
  };
}

export async function cancelChallengeAction(): Promise<LoginActionState> {
  const cookieStore = await cookies();
  cookieStore.delete({ name: CHALLENGE_COOKIE_NAME, path: "/admin" });
  return { step: "credentials", error: null };
}

export async function signOutAction(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token && isMongoConfigured()) {
    const db = await getDb();
    await revokeSession(db, token);
  }
  cookieStore.delete({ name: SESSION_COOKIE_NAME, path: "/admin" });
  redirect("/admin/login");
}

export async function acceptInviteAction(
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  if (!isMongoConfigured()) {
    return { error: "Database is not configured." };
  }

  const parsed = acceptInviteSchema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form fields." };
  }

  const db = await getDb();
  await ensureAdminIndexes(db);
  const meta = await getRequestMeta();
  const rateOk = await consumeRateLimit(
    db,
    `admin-invite:ip:${meta.ipHash}`,
    LOGIN_RATE_WINDOW_MS,
    10,
  );
  if (!rateOk) {
    return { error: "Too many attempts. Wait 15 minutes and try again." };
  }

  const res = await acceptInvite(db, {
    token: parsed.data.token,
    name: parsed.data.name,
    password: parsed.data.password,
  });
  if (!res.ok) {
    return { error: res.error };
  }

  await logAudit(db, res.admin, "admin.invite_accepted", res.admin.email, `Role: ${res.admin.role}`);

  redirect("/admin/login?invited=1");
}
