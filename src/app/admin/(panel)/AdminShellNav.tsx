"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/lib/admin/auth-actions";
import type { AdminRole } from "@/lib/admin/permissions";

export default function AdminShellNav({
  adminName,
  adminRole,
  unreadCount,
}: {
  adminName: string;
  adminRole: AdminRole;
  unreadCount: number;
}) {
  const pathname = usePathname();

  const links = [
    { href: "/admin", label: "Overview", exact: true },
    { href: "/admin/messages", label: "Messages", badge: unreadCount > 0 ? unreadCount : undefined },
    { href: "/admin/chess", label: "Chess" },
    { href: "/admin/admins", label: "Admins" },
  ];

  return (
    <aside className="admin-sidebar" aria-label="Admin navigation">
      <div className="admin-brand">
        <div>
          <Link href="/admin" className="admin-brand-title">
            Admin
          </Link>
          <div className="admin-brand-sub">carlsdaleescalo.com</div>
        </div>
        <Link href="/" className="admin-btn sm" target="_blank" rel="noopener noreferrer">
          Site ↗
        </Link>
      </div>

      <nav className="admin-nav">
        {links.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
              <span>{item.label}</span>
              {item.badge !== undefined ? (
                <span className="admin-badge accent" aria-label={`${item.badge} unread messages`}>
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="admin-sidebar-footer">
        <div className="admin-user-meta">
          <div className="admin-user-name">{adminName}</div>
          <div className="admin-user-role">signed in as · {adminRole}</div>
        </div>
        <form action={signOutAction}>
          <button type="submit" className="admin-btn sm">
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
