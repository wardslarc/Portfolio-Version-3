"use client";

import { useActionState } from "react";
import { acceptInviteAction, type InviteActionState } from "@/lib/admin/auth-actions";
import type { AdminRole } from "@/lib/admin/permissions";

const initial: InviteActionState = { error: null };

export default function InviteClient({
  token,
  email,
  role,
}: {
  token: string;
  email: string;
  role: AdminRole;
}) {
  const [state, action, pending] = useActionState(acceptInviteAction, initial);

  return (
    <div className="admin-auth-wrap">
      <div className="admin-auth-card">
        <div>
          <h1>Accept admin invite</h1>
          <p className="admin-auth-sub">
            {email} · <span className="mono">{role}</span>
          </p>
        </div>

        {state.error ? (
          <div className="admin-alert error" role="alert">
            {state.error}
          </div>
        ) : null}

        <form action={action} className="admin-form">
          <input type="hidden" name="token" value={token} />
          <div className="admin-field">
            <label htmlFor="invite-name">Your name</label>
            <input
              id="invite-name"
              name="name"
              className="admin-input"
              autoComplete="name"
              maxLength={80}
              required
              autoFocus
            />
          </div>
          <div className="admin-field">
            <label htmlFor="invite-pw">Password (min 12 characters)</label>
            <input
              id="invite-pw"
              name="password"
              type="password"
              className="admin-input"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </div>
          <div className="admin-field">
            <label htmlFor="invite-pw2">Confirm password</label>
            <input
              id="invite-pw2"
              name="confirmPassword"
              type="password"
              className="admin-input"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </div>
          <button type="submit" className="admin-btn primary" disabled={pending}>
            {pending ? "Creating account…" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
