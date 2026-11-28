import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import AuthShell from "@/components/admin-auth/AuthShell";
import styles from "@/components/admin-auth/AuthShell.module.css";
import {
  ADMIN_INVITES_COLLECTION,
  ensureAdminIndexes,
  type AdminInviteDoc,
} from "@/lib/admin/auth";
import { hmacHash } from "@/lib/admin/crypto";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import InviteClient from "./InviteClient";

export const metadata: Metadata = {
  title: "Accept invite",
};

async function InviteContent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!isMongoConfigured()) {
    return (
      <AuthShell
        kicker="Portfolio control panel"
        title={["Database not", "configured."]}
        note="staff only ✎"
      >
        <p style={{ margin: 0 }}>Set MONGODB_URI before accepting invites.</p>
      </AuthShell>
    );
  }

  const db = await getDb();
  await ensureAdminIndexes(db);
  const tokenHash = hmacHash("invite", token);
  const invite = await db.collection<AdminInviteDoc>(ADMIN_INVITES_COLLECTION).findOne({
    _id: tokenHash,
    acceptedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!invite) {
    return (
      <AuthShell
        kicker="Portfolio control panel"
        title={["Invite invalid", "or expired."]}
        note="staff only ✎"
      >
        <p style={{ margin: 0 }}>Ask an Owner to send a new invite link.</p>
        <Link href="/admin/login" className={styles.go} style={{ textDecoration: "none" }}>
          Go to sign-in <span aria-hidden="true">→</span>
        </Link>
      </AuthShell>
    );
  }

  return <InviteClient token={token} email={invite.email} role={invite.role} />;
}

export default function AdminInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <AuthShell
          kicker="Portfolio control panel"
          title={["Accept admin", "invite."]}
          note="staff only ✎"
        >
          <p style={{ margin: 0 }}>Checking invite…</p>
        </AuthShell>
      }
    >
      <InviteContent params={params} />
    </Suspense>
  );
}
