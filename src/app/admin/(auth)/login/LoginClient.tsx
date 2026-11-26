"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import {
  cancelChallengeAction,
  loginStepOneAction,
  resendCodeAction,
  verifyLoginCodeAction,
  type LoginActionState,
} from "@/lib/admin/auth-actions";

type LoginIntent =
  | { kind: "credentials"; formData: FormData }
  | { kind: "code"; formData: FormData }
  | { kind: "resend" }
  | { kind: "cancel" };

export default function LoginClient({
  initialState,
  invitedNotice,
}: {
  initialState: LoginActionState;
  invitedNotice: boolean;
}) {
  // One state for the whole flow: the latest server reply always decides which step is shown.
  // (Three separate action states made a failed sign-in look like "nothing happened", because
  // an error on the credentials step was indistinguishable from the untouched initial state.)
  const [state, dispatch, pending] = useActionState(
    async (prev: LoginActionState, intent: LoginIntent): Promise<LoginActionState> => {
      switch (intent.kind) {
        case "credentials":
          return loginStepOneAction(prev, intent.formData);
        case "code":
          return verifyLoginCodeAction(prev, intent.formData);
        case "resend":
          return resendCodeAction(prev);
        case "cancel":
          return cancelChallengeAction();
      }
    },
    initialState,
  );
  const [pendingKind, setPendingKind] = useState<LoginIntent["kind"] | null>(null);
  const run = (intent: LoginIntent) => {
    setPendingKind(intent.kind);
    dispatch(intent);
  };

  const [email, setEmail] = useState("");
  const [backupMode, setBackupMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const activeState = state;
  const displayError = activeState.step !== "backup_codes" ? activeState.error : null;
  const credPending = pending && pendingKind === "credentials";
  const codePending = pending && pendingKind === "code";
  const resendPending = pending && pendingKind === "resend";

  const resendAtMs = activeState.step === "code" ? new Date(activeState.resendAvailableAt).getTime() : 0;
  const secondsLeft = Math.max(0, Math.ceil((resendAtMs - nowMs) / 1000));

  useEffect(() => {
    if (activeState.step !== "code" || secondsLeft <= 0) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeState.step, secondsLeft]);

  if (activeState.step === "backup_codes") {
    return (
      <div className="admin-auth-wrap">
        <div className="admin-auth-card">
          <h1>Save your backup codes</h1>
          <p className="admin-auth-sub">
            Each code works once if you lose access to your email. They will not be shown again.
          </p>
          <div className="admin-backup-grid" aria-label="Backup codes">
            {activeState.codes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <div className="admin-row-actions">
            <button
              type="button"
              className="admin-btn"
              onClick={async () => {
                await navigator.clipboard.writeText(activeState.codes.join("\n"));
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? "Copied" : "Copy codes"}
            </button>
            <Link href="/admin" className="admin-btn primary">
              Continue to Admin
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (activeState.step === "code") {
    const notice = activeState.notice ?? null;
    return (
      <div className="admin-auth-wrap">
        <div className="admin-auth-card">
          <h1>Verify sign-in</h1>
          <p className="admin-auth-sub">
            {backupMode
              ? "Enter one of your 8-character backup codes."
              : `Enter the 6-digit code sent to ${activeState.maskedEmail}.`}
          </p>

          {displayError ? <div className="admin-alert error" role="alert">{displayError}</div> : null}
          {notice ? <div className="admin-alert ok" role="status">{notice}</div> : null}

          <form action={(formData) => run({ kind: "code", formData })} className="admin-form">
            <div className="admin-field">
              <label htmlFor="admin-code">{backupMode ? "Backup code" : "6-digit code"}</label>
              <input
                id="admin-code"
                name="code"
                className="admin-input mono"
                autoComplete="one-time-code"
                inputMode={backupMode ? "text" : "numeric"}
                placeholder={backupMode ? "XXXX-XXXX" : "000000"}
                required
                autoFocus
              />
            </div>

            <label className="admin-check">
              <input type="checkbox" name="trustDevice" />
              Trust this device for 30 days
            </label>

            <button type="submit" className="admin-btn primary" disabled={codePending}>
              {codePending ? "Verifying…" : "Verify & sign in"}
            </button>
          </form>

          <div className="admin-row-actions">
            <button
              type="button"
              className="admin-btn sm"
              onClick={() => setBackupMode((v) => !v)}
            >
              {backupMode ? "Use email code" : "Use backup code"}
            </button>

            <form action={() => run({ kind: "resend" })}>
              <button
                type="submit"
                className="admin-btn sm"
                disabled={resendPending || secondsLeft > 0}
              >
                {secondsLeft > 0 ? `Resend (${secondsLeft}s)` : resendPending ? "Sending…" : "Resend code"}
              </button>
            </form>

            <form
              action={() => {
                setBackupMode(false);
                run({ kind: "cancel" });
              }}
            >
              <button type="submit" className="admin-btn sm">
                Back
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-auth-wrap">
      <div className="admin-auth-card">
        <div>
          <h1>Admin sign-in</h1>
          <p className="admin-auth-sub">Portfolio control panel</p>
        </div>

        {invitedNotice ? (
          <div className="admin-alert ok" role="status">
            Account created. Sign in with your email and password.
          </div>
        ) : null}

        {displayError ? (
          <div className="admin-alert error" role="alert">
            {displayError}
          </div>
        ) : null}

        <form action={(formData) => run({ kind: "credentials", formData })} className="admin-form">
          <div className="admin-field">
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              name="email"
              type="email"
              className="admin-input"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="admin-field">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              className="admin-input"
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="admin-btn primary" disabled={credPending}>
            {credPending ? "Checking…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
