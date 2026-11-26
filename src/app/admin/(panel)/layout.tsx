import { Suspense, type ReactNode } from "react";
import { requireAdmin } from "@/lib/admin/auth";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import AdminShellNav from "./AdminShellNav";

async function GuardedShell({ children }: { children: ReactNode }) {
  const { admin } = await requireAdmin("viewer");

  let unreadCount = 0;
  if (isMongoConfigured()) {
    const db = await getDb();
    unreadCount = await db.collection("messages").countDocuments({
      $and: [
        { $or: [{ readAt: null }, { readAt: { $exists: false } }] },
        { $or: [{ archivedAt: null }, { archivedAt: { $exists: false } }] },
      ],
    });
  }

  return (
    <div className="admin-shell">
      <AdminShellNav adminName={admin.name} adminRole={admin.role} unreadCount={unreadCount} />
      <main className="admin-main">{children}</main>
    </div>
  );
}

export default function AdminPanelLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="admin-auth-wrap">
          <div className="admin-auth-card">Loading admin…</div>
        </div>
      }
    >
      <GuardedShell>{children}</GuardedShell>
    </Suspense>
  );
}
