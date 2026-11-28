"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type CSSProperties } from "react";
import AuthShell from "@/components/admin-auth/AuthShell";
import styles from "@/components/admin-auth/AuthShell.module.css";
import OtpInput from "@/components/admin-auth/OtpInput";
import { useShake } from "@/components/admin-auth/useShake";
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

const TICKET_ROTS = ["-1.5deg", "1deg", "0.5deg", "-1deg", "1.5deg"] as const;

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
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeState = state;
  const displayError = activeState.step !== "backup_codes" ? activeState.error : null;
  const shakeClass = useShake(displayError, activeState);
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

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  if (activeState.step === "backup_codes") {
    return (
      <AuthShell
        kicker="First sign-in · one time only"
        title={["Save your", "backup codes."]}
        lede="Each code works once if you lose access to your email. They will not be shown again."
        note="keep these somewhere safe ✎"
        notePlacement="bottom"
        twoTapes
        back={false}
      >
        <div className={styles.tickets} aria-label="Backup codes">
          {activeState.codes.map((c, i) => (
            <span
              key={c}
              className={`${styles.ticket} k-in-drop`}
              style={
                {
                  "--rot": TICKET_ROTS[i % TICKET_ROTS.length],
                  "--r0": i % 2 ? "-10deg" : "10deg",
                  animationDelay: `${(0.9 + i * 0.07).toFixed(2)}s`,
                } as CSSProperties
              }
            >
              {c}
            </span>
          ))}
        </div>
        <div className={styles.row}>
          <button
            type="button"
            className={styles.small}
            style={{ position: "relative" }}
            onClick={async () => {
              await navigator.clipboard.writeText(activeState.codes.join("\n"));
              setCopied(true);
              if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
              copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "Copied" : "Copy codes"}
            {copied ? (
              <span className={`k-note ${styles.copiedPop}`} aria-live="polite">
                copied!
              </span>
            ) : null}
          </button>
          <Link href="/admin" className={styles.go} style={{ flex: 1, textDecoration: "none" }}>
            Continue to Admin <span aria-hidden="true">→</span>
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (activeState.step === "code") {
    const notice = activeState.notice ?? null;
    return (
      <AuthShell
        kicker="Step 2 of 2 · two-factor"
        title={["Verify", "sign-in."]}
        lede={
          backupMode
            ? "Enter one of your 8-character backup codes."
            : `Enter the 6-digit code sent to ${activeState.maskedEmail}.`
        }
        note="check your inbox ✎"
        shakeClass={shakeClass}
      >
        {displayError ? (
          <div className={`${styles.alert} ${styles.err} k-in-pop`} role="alert">
            {displayError}
          </div>
        ) : null}
        {notice ? (
          <div className={`${styles.alert} ${styles.ok} k-in-pop`} role="status">
            {notice}
          </div>
        ) : null}

        <form action={(formData) => run({ kind: "code", formData })} className={styles.form}>
          {backupMode ? (
            <div className={styles.field}>
              <label htmlFor="admin-code">Backup code</label>
              <input
                id="admin-code"
                name="code"
                className={`${styles.monoIn} k-in-pop`}
                autoComplete="one-time-code"
                inputMode="text"
                placeholder="XXXX-XXXX"
                required
                autoFocus
              />
            </div>
          ) : (
            <OtpInput />
          )}

          <label className={styles.tick}>
            <input type="checkbox" name="trustDevice" />
            Trust this device for 30 days
          </label>

          <button type="submit" className={styles.go} disabled={codePending}>
            {codePending ? "Verifying…" : "Verify & sign in"}{" "}
            <span aria-hidden="true">→</span>
          </button>
        </form>

        <div className={styles.row}>
          <button
            type="button"
            className={styles.small}
            onClick={() => setBackupMode((v) => !v)}
          >
            {backupMode ? "Use email code" : "Use backup code"}
          </button>

          <form action={() => run({ kind: "resend" })}>
            <button
              type="submit"
              className={styles.small}
              disabled={resendPending || secondsLeft > 0}
            >
              {secondsLeft > 0
                ? `Resend (${secondsLeft}s)`
                : resendPending
                  ? "Sending…"
                  : "Resend code"}
            </button>
          </form>

          <form
            action={() => {
              setBackupMode(false);
              run({ kind: "cancel" });
            }}
          >
            <button type="submit" className={styles.small}>
              Back
            </button>
          </form>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      kicker="Portfolio control panel"
      title={["Admin", "sign-in."]}
      lede="Posts, messages, media and the chess board live behind this door."
      note="staff only ✎"
      shakeClass={shakeClass}
    >
      {invitedNotice ? (
        <div className={`${styles.alert} ${styles.ok} k-in-pop`} role="status">
          Account created. Sign in with your email and password.
        </div>
      ) : null}

      {displayError ? (
        <div className={`${styles.alert} ${styles.err} k-in-pop`} role="alert">
          {displayError}
        </div>
      ) : null}

      <form action={(formData) => run({ kind: "credentials", formData })} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <button
          type="submit"
          className={styles.go}
          style={{ marginTop: "4px" }}
          disabled={credPending}
        >
          {credPending ? "Checking…" : "Continue"} <span aria-hidden="true">→</span>
        </button>
      </form>
    </AuthShell>
  );
}
