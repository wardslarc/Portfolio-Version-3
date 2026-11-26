import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/auth";
import { queryAdminsPageData } from "@/lib/admin/data";
import { can } from "@/lib/admin/permissions";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import AdminsClient from "./AdminsClient";

export const metadata: Metadata = {
  title: "Admins",
};

async function AdminsContent() {
  const { admin, session } = await requireAdmin("viewer");
  if (!isMongoConfigured()) {
    return (
      <div className="admin-card">
        <p className="admin-auth-sub">Database is not configured.</p>
      </div>
    );
  }

  const canManageAdmins = can(admin.role, "admins:manage");
  const canViewAudit = can(admin.role, "audit:view");
  const db = await getDb();
  const data = await queryAdminsPageData(db, admin, session._id, {
    canManageAdmins,
    canViewAudit,
  });

  return (
    <AdminsClient
      currentAdminId={admin._id.toString()}
      canManageAdmins={canManageAdmins}
      canViewAudit={canViewAudit}
      admins={data.admins}
      invites={data.invites}
      sessions={data.sessions}
      audit={data.audit}
      backupCodesRemaining={data.backupCodesRemaining}
    />
  );
}

export default function AdminAdminsPage() {
  return (
    <Suspense fallback={<div className="admin-card">Loading admins…</div>}>
      <AdminsContent />
    </Suspense>
  );
}
