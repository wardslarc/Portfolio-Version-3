"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  changeAdminRoleAction,
  changeOwnPasswordAction,
  inviteAdminAction,
  regenerateBackupCodesAction,
  removeAdminAction,
  resendInviteAction,
  revokeInviteAction,
  revokeOwnSessionAction,
} from "@/lib/admin/actions";
import type {
  SerializedAdminRow,
  SerializedAuditRow,
  SerializedInviteRow,
  SerializedSessionRow,
} from "@/lib/admin/data";
import { ROLE_LABELS, type AdminRole } from "@/lib/admin/permissions";

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminsClient({
  currentAdminId,
  canManageAdmins,
  canViewAudit,
  admins,
  invites,
  sessions,
  audit,
  backupCodesRemaining,
}: {
  currentAdminId: string;
  canManageAdmins: boolean;
  canViewAudit: boolean;
  admins: SerializedAdminRow[];
  invites: SerializedInviteRow[];
  sessions: SerializedSessionRow[];
  audit: SerializedAuditRow[];
  backupCodesRemaining: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // Invite dialog state
  const inviteDialogRef = useRef<HTMLDialogElement>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AdminRole>("admin");

  // Remove admin dialog state
  const removeDialogRef = useRef<HTMLDialogElement>(null);
  const [removeTarget, setRemoveTarget] = useState<SerializedAdminRow | null>(null);

  // Change password state
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  // Regenerated backup codes
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [copiedCodes, setCopiedCodes] = useState(false);

  function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await inviteAdminAction(inviteEmail, inviteRole);
      if (!res.ok) {
        setFeedback({ kind: "error", text: res.error ?? "Failed to invite." });
        return;
      }
      inviteDialogRef.current?.close();
      setInviteEmail("");
      setFeedback({
        kind: "ok",
        text: res.emailed ? "Invite sent by email." : "Invite created (email not configured).",
      });
      router.refresh();
    });
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setFeedback({ kind: "error", text: "New passwords do not match." });
      return;
    }
    startTransition(async () => {
      const res = await changeOwnPasswordAction(curPw, newPw);
      if (!res.ok) {
        setFeedback({ kind: "error", text: res.error ?? "Failed to update password." });
        return;
      }
      setCurPw("");
      setNewPw("");
      setConfirmPw("");
      setFeedback({ kind: "ok", text: "Password updated. Other sessions signed out." });
      router.refresh();
    });
  }

  return (
    <div className="admin-stack">
      <div className="admin-page-head">
        <h1>Admins &amp; security</h1>
        {canManageAdmins ? (
          <button
            type="button"
            className="admin-btn sm primary"
            onClick={() => inviteDialogRef.current?.showModal()}
          >
            Invite admin
          </button>
        ) : null}
      </div>

      {feedback ? (
        <div className={`admin-alert ${feedback.kind}`} role="status">
          {feedback.text}
        </div>
      ) : null}

      {canManageAdmins ? (
        <div className="admin-card">
          <h2>Team</h2>
          <div className="admin-table-wrap">
            <table className="admin-table stack-mobile">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Last sign-in</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id}>
                    <td data-label="Name" style={{ fontWeight: 500 }}>
                      <span>
                        {a.name}
                        {a.id === currentAdminId ? (
                          <span className="admin-badge" style={{ marginLeft: "8px" }}>
                            You
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td data-label="Email" className="mono">{a.email}</td>
                    <td data-label="Role">
                      <label htmlFor={`role-${a.id}`} className="skip">
                        Role for {a.name}
                      </label>
                      <select
                        id={`role-${a.id}`}
                        className="admin-select"
                        style={{ minHeight: "36px", width: "auto" }}
                        value={a.role}
                        disabled={pending}
                        onChange={(e) => {
                          const nextRole = e.target.value as AdminRole;
                          startTransition(async () => {
                            const res = await changeAdminRoleAction(a.id, nextRole);
                            setFeedback(
                              res.ok
                                ? { kind: "ok", text: `Updated role for ${a.name}.` }
                                : { kind: "error", text: res.error ?? "Failed to update role." },
                            );
                            router.refresh();
                          });
                        }}
                      >
                        <option value="owner">{ROLE_LABELS.owner}</option>
                        <option value="admin">{ROLE_LABELS.admin}</option>
                        <option value="viewer">{ROLE_LABELS.viewer}</option>
                      </select>
                    </td>
                    <td data-label="Last sign-in" className="mono" style={{ color: "var(--muted)" }}>
                      {formatDate(a.lastSignInAt)}
                    </td>
                    <td data-label="Actions">
                      <div className="admin-row-actions">
                        <button
                          type="button"
                          className="admin-btn sm danger"
                          disabled={pending}
                          onClick={() => {
                            setRemoveTarget(a);
                            removeDialogRef.current?.showModal();
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {invites.length > 0 ? (
            <>
              <h3 style={{ margin: "8px 0 0", fontSize: "0.9375rem" }}>Pending invites</h3>
              <div className="admin-table-wrap">
                <table className="admin-table stack-mobile">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Expires</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((inv) => (
                      <tr key={inv.email}>
                        <td data-label="Email" className="mono">{inv.email}</td>
                        <td data-label="Role" className="mono">{ROLE_LABELS[inv.role]}</td>
                        <td data-label="Expires" className="mono" style={{ color: "var(--muted)" }}>
                          {formatDate(inv.expiresAt)}
                        </td>
                        <td data-label="Actions">
                          <div className="admin-row-actions">
                            <button
                              type="button"
                              className="admin-btn sm"
                              disabled={pending}
                              onClick={() => {
                                startTransition(async () => {
                                  const res = await resendInviteAction(inv.email);
                                  setFeedback(
                                    res.ok
                                      ? { kind: "ok", text: `Resent invite to ${inv.email}.` }
                                      : { kind: "error", text: res.error ?? "Failed to resend." },
                                  );
                                  router.refresh();
                                });
                              }}
                            >
                              Resend
                            </button>
                            <button
                              type="button"
                              className="admin-btn sm danger"
                              disabled={pending}
                              onClick={() => {
                                startTransition(async () => {
                                  await revokeInviteAction(inv.email);
                                  setFeedback({ kind: "ok", text: `Revoked invite for ${inv.email}.` });
                                  router.refresh();
                                });
                              }}
                            >
                              Revoke
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="admin-two-col">
        <div className="admin-card">
          <h2>Your security · Change password</h2>
          <form onSubmit={handlePasswordSubmit} className="admin-form">
            <div className="admin-field">
              <label htmlFor="sec-cur-pw">Current password</label>
              <input
                id="sec-cur-pw"
                type="password"
                className="admin-input"
                value={curPw}
                onChange={(e) => setCurPw(e.target.value)}
                required
              />
            </div>
            <div className="admin-field">
              <label htmlFor="sec-new-pw">New password (min 12 characters)</label>
              <input
                id="sec-new-pw"
                type="password"
                className="admin-input"
                minLength={12}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                required
              />
            </div>
            <div className="admin-field">
              <label htmlFor="sec-confirm-pw">Confirm new password</label>
              <input
                id="sec-confirm-pw"
                type="password"
                className="admin-input"
                minLength={12}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="admin-btn sm primary" disabled={pending}>
              Update password
            </button>
          </form>
        </div>

        <div className="admin-card">
          <div className="admin-row-actions" style={{ justifyContent: "space-between" }}>
            <h2>Backup codes</h2>
            <span className="admin-badge">{backupCodesRemaining} unused</span>
          </div>
          <p className="admin-auth-sub">
            Regenerating invalidates any previously saved backup codes.
          </p>
          <div>
            <button
              type="button"
              className="admin-btn sm"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const res = await regenerateBackupCodesAction();
                  setNewCodes(res.codes);
                  setCopiedCodes(false);
                  router.refresh();
                });
              }}
            >
              Regenerate 10 backup codes
            </button>
          </div>

          {newCodes ? (
            <div className="admin-stack">
              <div className="admin-backup-grid">
                {newCodes.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
              <div>
                <button
                  type="button"
                  className="admin-btn sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(newCodes.join("\n"));
                    setCopiedCodes(true);
                    setTimeout(() => setCopiedCodes(false), 2000);
                  }}
                >
                  {copiedCodes ? "Copied" : "Copy codes"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="admin-card">
        <h2>Signed-in sessions</h2>
        <div className="admin-table-wrap">
          <table className="admin-table stack-mobile">
            <thead>
              <tr>
                <th>Device</th>
                <th>Location</th>
                <th>Last seen</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td
                    data-label="Device"
                    style={{ maxWidth: "340px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    <span>
                      {s.userAgent}
                      {s.isCurrent ? (
                        <span className="admin-badge ok" style={{ marginLeft: "8px" }}>
                          Current
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td data-label="Location">{[s.city, s.country].filter(Boolean).join(", ") || "—"}</td>
                  <td data-label="Last seen" className="mono" style={{ color: "var(--muted)" }}>
                    {formatDate(s.lastSeenAt)}
                  </td>
                  <td data-label="Action">
                    <div className="admin-row-actions">
                      <button
                        type="button"
                        className="admin-btn sm"
                        disabled={pending || s.isCurrent}
                        onClick={() => {
                          startTransition(async () => {
                            await revokeOwnSessionAction(s.id);
                            router.refresh();
                          });
                        }}
                      >
                        Sign out
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {canViewAudit ? (
        <div className="admin-card">
          <h2>Activity log</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((e) => (
                  <tr key={e.id}>
                    <td className="mono" style={{ color: "var(--muted)" }}>
                      {formatDate(e.at)}
                    </td>
                    <td>{e.adminName}</td>
                    <td className="mono">{e.action}</td>
                    <td className="mono">{e.target}</td>
                    <td>{e.detail || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <dialog ref={inviteDialogRef} className="admin-dialog" aria-labelledby="invite-dlg-title">
        <form onSubmit={handleInviteSubmit} className="admin-stack">
          <h2 id="invite-dlg-title" style={{ margin: 0 }}>
            Invite admin
          </h2>
          <div className="admin-field">
            <label htmlFor="inv-email">Email</label>
            <input
              id="inv-email"
              type="email"
              className="admin-input"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
          </div>
          <div className="admin-field">
            <label htmlFor="inv-role">Role</label>
            <select
              id="inv-role"
              className="admin-select"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as AdminRole)}
            >
              <option value="admin">{ROLE_LABELS.admin}</option>
              <option value="viewer">{ROLE_LABELS.viewer}</option>
              <option value="owner">{ROLE_LABELS.owner}</option>
            </select>
          </div>
          <div className="admin-row-actions" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="admin-btn sm" onClick={() => inviteDialogRef.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="admin-btn sm primary" disabled={pending}>
              Send invite
            </button>
          </div>
        </form>
      </dialog>

      <dialog ref={removeDialogRef} className="admin-dialog" aria-labelledby="remove-dlg-title">
        <div className="admin-stack">
          <h2 id="remove-dlg-title" style={{ margin: 0 }}>
            Remove {removeTarget?.name}?
          </h2>
          <p className="admin-auth-sub">
            This deletes their account, active sessions, and trusted devices immediately.
          </p>
          <div className="admin-row-actions" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="admin-btn sm" onClick={() => removeDialogRef.current?.close()}>
              Cancel
            </button>
            <button
              type="button"
              className="admin-btn sm danger"
              disabled={pending}
              onClick={() => {
                if (!removeTarget) return;
                removeDialogRef.current?.close();
                startTransition(async () => {
                  const res = await removeAdminAction(removeTarget.id);
                  setFeedback(
                    res.ok
                      ? { kind: "ok", text: `Removed ${removeTarget.name}.` }
                      : { kind: "error", text: res.error ?? "Failed to remove admin." },
                  );
                  router.refresh();
                });
              }}
            >
              Remove admin
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
