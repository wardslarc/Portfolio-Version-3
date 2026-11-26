import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  ADMINS_COLLECTION,
  ADMIN_CHALLENGES_COLLECTION,
  CHALLENGE_COOKIE_NAME,
  ensureAdminIndexes,
  getCurrentAdmin,
  type AdminDoc,
  type AdminLoginChallengeDoc,
} from "@/lib/admin/auth";
import type { LoginActionState } from "@/lib/admin/auth-actions";
import { maskEmail } from "@/lib/admin/crypto";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Sign in",
};

async function LoginContent({ searchParams }: { searchParams: Promise<{ invited?: string }> }) {
  const sp = await searchParams;
  const invitedNotice = sp.invited === "1";

  let initialState: LoginActionState = { step: "credentials", error: null };

  if (isMongoConfigured()) {
    const current = await getCurrentAdmin();
    if (current) {
      redirect("/admin");
    }

    const cookieStore = await cookies();
    const challengeId = cookieStore.get(CHALLENGE_COOKIE_NAME)?.value;
    if (challengeId) {
      const db = await getDb();
      await ensureAdminIndexes(db);
      const now = new Date();
      const challenge = await db.collection<AdminLoginChallengeDoc>(ADMIN_CHALLENGES_COLLECTION).findOne({
        _id: challengeId,
        expiresAt: { $gt: now },
      });
      if (challenge) {
        const admin = await db.collection<AdminDoc>(ADMINS_COLLECTION).findOne({ _id: challenge.adminId });
        if (admin && admin.disabledAt === null) {
          initialState = {
            step: "code",
            maskedEmail: maskEmail(admin.email),
            resendAvailableAt: challenge.resendAvailableAt.toISOString(),
            error: null,
          };
        }
      }
    }
  }

  return <LoginClient initialState={initialState} invitedNotice={invitedNotice} />;
}

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ invited?: string }>;
}) {
  return (
    <Suspense fallback={<div className="admin-auth-wrap"><div className="admin-auth-card">Loading…</div></div>}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}
