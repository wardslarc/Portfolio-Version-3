import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
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
      <div className="admin-auth-wrap">
        <div className="admin-auth-card">
          <h1>Database not configured</h1>
          <p className="admin-auth-sub">Set MONGODB_URI before accepting invites.</p>
        </div>
      </div>
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
      <div className="admin-auth-wrap">
        <div className="admin-auth-card">
          <h1>Invite invalid or expired</h1>
          <p className="admin-auth-sub">Ask an Owner to send a new invite link.</p>
          <Link href="/admin/login" className="admin-btn">
            Go to sign-in
          </Link>
        </div>
      </div>
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
    <Suspense fallback={<div className="admin-auth-wrap"><div className="admin-auth-card">Checking invite…</div></div>}>
      <InviteContent params={params} />
    </Suspense>
  );
}
