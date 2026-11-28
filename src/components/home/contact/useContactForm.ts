"use client";

import { track } from "@vercel/analytics";
import { useRef, useState, type FormEvent } from "react";
import { site } from "@/content/site";
import { validate, type FieldErrors, type Status } from "./validate";

export function useContactForm() {
  const [copied, setCopied] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });
  const emailRef = useRef<HTMLElement>(null);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(site.email);
      setCopied("copied!");
      setTimeout(() => setCopied(""), 1800);
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
      track("contact_submitted");
      setStatus({ kind: "ok", text: "Message sent. I'll reply to you by email." });
    } catch {
      setStatus({ kind: "error", text: "You seem to be offline. Check your connection and try again." });
    }
  }

  const sending = status.kind === "sending";

  return { errors, status, sending, onSubmit, copyEmail, copied, emailRef };
}
