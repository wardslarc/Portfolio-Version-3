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

export default function LoginClient({
  initialState,
  invitedNotice,
}: {
  initialState: LoginActionState;
  invitedNotice: boolean;
}) {
  const [credState, credAction, credPending] = useActionState(loginStepOneAction, initialState);
  const [codeState, codeAction, codePending] = useActionState(verifyLoginCodeAction, initialState);
  const [resendState, resendAction, resendPending] = useActionState(resendCodeAction, initialState);

  const [backupMode, setBackupMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Determine the most recent active step across the three actions
  const activeState: LoginActionState =
    codeState.step === "backup_codes"
      ? codeState
      : resendState.step === "code" && credState.step === "code"
        ? resendState
        : codeState.step !== initialState.step
          ? codeState
          : credState.step !== initialState.step
            ? credState
            : initialState;

  // Prefer the latest error/notice from whichever action was triggered last
  const displayError =
    (activeState.step !== "backup_codes" && activeState.error) ||
    (codeState.step === "code" && codeState.error) ||
    (resendState.step === "code" && resendState.error) ||
    null;

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
    const notice = resendState.step === "code" ? resendState.notice : null;
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

          <form action={codeAction} className="admin-form">
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

            <form action={resendAction}>
              <button
                type="submit"
                className="admin-btn sm"
                disabled={resendPending || secondsLeft > 0}
              >
                {secondsLeft > 0 ? `Resend (${secondsLeft}s)` : resendPending ? "Sending…" : "Resend code"}
              </button>
            </form>

            <form action={cancelChallengeAction}>
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

        <form action={credAction} className="admin-form">
          <div className="admin-field">
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              name="email"
              type="email"
              className="admin-input"
              autoComplete="email"
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
