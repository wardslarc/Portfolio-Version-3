"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Onigiri from "@/components/home/Onigiri";
import ThemeToggle from "@/components/ink/ThemeToggle";
import { signOutAction } from "@/lib/admin/auth-actions";
import { ROLE_LABELS, type AdminRole } from "@/lib/admin/permissions";

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
  const navRef = useRef<HTMLElement>(null);
  const activeLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    const activeEl = activeLinkRef.current;
    if (!nav || !activeEl) return;
    if (nav.scrollWidth > nav.clientWidth) {
      activeEl.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [pathname]);

  const links = [
    { href: "/admin", label: "Overview", exact: true },
    { href: "/admin/messages", label: "Messages", badge: unreadCount > 0 ? unreadCount : undefined },
    { href: "/admin/blog", label: "Blog" },
    { href: "/admin/media", label: "Media" },
    { href: "/admin/chess", label: "Chess" },
    { href: "/admin/admins", label: "Admins" },
  ];

  return (
    <aside className="admin-sidebar" aria-label="Admin navigation">
      <div className="admin-brand">
        <div>
          <Link href="/admin" className="admin-brand-title">
            <Onigiri variant="logo" className="admin-brand-logo" />
            <span>Admin</span>
          </Link>
          <div className="admin-brand-sub">carlsdaleescalo.com</div>
        </div>
        <Link href="/" className="admin-btn sm" target="_blank" rel="noopener noreferrer">
          Site ↗
        </Link>
      </div>

      <span className="admin-sidebar-note" aria-hidden="true">
        control panel ✎
      </span>

      <nav className="admin-nav" ref={navRef}>
        {links.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={active ? activeLinkRef : undefined}
              aria-current={active ? "page" : undefined}
            >
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
          <div className="admin-user-role">Signed in as · {ROLE_LABELS[adminRole]}</div>
        </div>
        <div className="admin-row-actions">
          <ThemeToggle className="admin-theme-toggle" />
          <form action={signOutAction}>
            <button type="submit" className="admin-btn sm">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
