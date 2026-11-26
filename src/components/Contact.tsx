"use client";

import { useRef, useState, type FormEvent } from "react";
import { site } from "@/content/site";

type FieldErrors = Partial<Record<"name" | "email" | "message", string>>;
type Status = { kind: "idle" | "sending" | "ok" | "error"; text: string };

function validate(name: string, email: string, message: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!name.trim()) errors.name = "Enter your name.";
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = "Enter an email like name@company.com.";
  if (message.trim().length < 10) errors.message = "Write at least a sentence so I know what you need.";
  return errors;
}

export default function Contact() {
  const [copied, setCopied] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });
  const emailRef = useRef<HTMLAnchorElement>(null);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(site.email);
      setCopied("Copied");
      setTimeout(() => setCopied(""), 2000);
    } catch {
      const el = emailRef.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      setCopied("Selected. Press Ctrl+C to copy.");
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "");
    const email = String(data.get("email") ?? "");
    const message = String(data.get("message") ?? "");
    const website = String(data.get("website") ?? "");

    const found = validate(name, email, message);
    setErrors(found);
    const firstInvalid = (["name", "email", "message"] as const).find((k) => found[k]);
    if (firstInvalid) {
      setStatus({ kind: "error", text: "Check the highlighted fields." });
      form.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    setStatus({ kind: "sending", text: "Sending…" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, website }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; fieldErrors?: FieldErrors };
      if (!res.ok) {
        if (body.fieldErrors) setErrors(body.fieldErrors);
        setStatus({ kind: "error", text: body.error ?? "Your message didn't send. Try again, or email me directly." });
        return;
      }
      form.reset();
      setStatus({ kind: "ok", text: "Message sent. I'll reply to you by email." });
    } catch {
      setStatus({ kind: "error", text: "You seem to be offline. Check your connection and try again." });
    }
  }

  const sending = status.kind === "sending";

  return (
    <section id="contact" className="contact" aria-labelledby="contact-h">
      <h2 className="section-label" id="contact-h">
        Contact
      </h2>
      <p>Have a project or a role in mind? Email me directly, or send a message here and I&apos;ll reply by email.</p>
      <div className="email-row">
        <a className="email" href={`mailto:${site.email}`} ref={emailRef}>
          {site.email}
        </a>
        <button className="btn" type="button" onClick={copyEmail}>
          Copy email
        </button>
        <span className="copied" aria-live="polite">
          {copied}
        </span>
      </div>

      <form className="contact-form" onSubmit={onSubmit} noValidate>
        <div className="pair">
          <div className="field">
            <label htmlFor="f-name">Name</label>
            <input id="f-name" name="name" autoComplete="name" maxLength={80} aria-invalid={errors.name ? true : undefined} aria-describedby="e-name" />
            {errors.name ? <span className="err" id="e-name">{errors.name}</span> : null}
          </div>
          <div className="field">
            <label htmlFor="f-email">Email</label>
            <input id="f-email" name="email" type="email" autoComplete="email" inputMode="email" maxLength={200} aria-invalid={errors.email ? true : undefined} aria-describedby="e-email" />
            {errors.email ? <span className="err" id="e-email">{errors.email}</span> : null}
          </div>
        </div>
        <div className="field">
          <label htmlFor="f-msg">
            Message <span className="hint">· what you&apos;re building and when</span>
          </label>
          <textarea id="f-msg" name="message" maxLength={2000} aria-invalid={errors.message ? true : undefined} aria-describedby="e-msg" />
          {errors.message ? <span className="err" id="e-msg">{errors.message}</span> : null}
        </div>
        {/* Honeypot: hidden from people, filled in by most bots. */}
        <div className="hp" aria-hidden="true">
          <label htmlFor="f-website">Website</label>
          <input id="f-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <div className="form-foot">
          <span className={`status${status.kind === "ok" ? " ok" : status.kind === "error" ? " error" : ""}`} aria-live="polite">
            {status.text}
          </span>
          <button className="btn solid" type="submit" disabled={sending}>
            {sending ? "Sending…" : "Send message"}
          </button>
        </div>
      </form>
    </section>
  );
}
