"use client";

import { useActionState, useState } from "react";
import AuthShell from "@/components/admin-auth/AuthShell";
import styles from "@/components/admin-auth/AuthShell.module.css";
import { useShake } from "@/components/admin-auth/useShake";
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
  const [pwLen, setPwLen] = useState(0);
  const shakeClass = useShake(state.error, state);
  const pct = Math.min(100, Math.round((pwLen / 12) * 100));

  return (
    <AuthShell
      kicker={`${email} · ${role}`}
      title={["Accept admin", "invite."]}
      lede="Pick your name and a password to create your account."
      note="welcome aboard!"
      shakeClass={shakeClass}
    >
      {state.error ? (
        <div className={`${styles.alert} ${styles.err} k-in-pop`} role="alert">
          {state.error}
        </div>
      ) : null}

      <form action={action} className={styles.form}>
        <input type="hidden" name="token" value={token} />
        <div className={styles.field}>
          <label htmlFor="invite-name">Your name</label>
          <input
            id="invite-name"
            name="name"
            autoComplete="name"
            maxLength={80}
            required
            autoFocus
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="invite-pw">Password (min 12 characters)</label>
          <input
            id="invite-pw"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            onChange={(e) => setPwLen(e.target.value.length)}
          />
          <div className={styles.meterTrack} aria-hidden="true">
            <div
              className={styles.meterFill}
              style={{
                width: `${pct}%`,
                backgroundColor: pwLen >= 12 ? "#1F7A4D" : "#E8492A",
              }}
            />
          </div>
          <span className={styles.meterText} aria-hidden="true">
            {pwLen >= 12 ? "long enough ✓" : `${pwLen} / 12 characters`}
          </span>
        </div>
        <div className={styles.field}>
          <label htmlFor="invite-pw2">Confirm password</label>
          <input
            id="invite-pw2"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </div>
        <button
          type="submit"
          className={styles.go}
          style={{ marginTop: "4px" }}
          disabled={pending}
        >
          {pending ? "Creating account…" : "Create account"}{" "}
          <span aria-hidden="true">→</span>
        </button>
      </form>
    </AuthShell>
  );
}
