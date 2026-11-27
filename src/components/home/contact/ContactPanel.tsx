"use client";

import { contact } from "@/content/home";
import { site } from "@/content/site";
import shellStyles from "../HomeShell.module.css";
import styles from "./ContactPanel.module.css";
import { useContactForm } from "./useContactForm";

export default function ContactPanel() {
  const { errors, status, sending, onSubmit, copyEmail, copied, emailRef } = useContactForm();

  return (
    <div className={styles.cols}>
      <div className={styles.left}>
        <h2 id="contact-h" className={styles.heading}>
          <span className={shellStyles.ln}>
            <span data-anim="heading-line">{contact.heading[0]}</span>
          </span>
          <span className={shellStyles.ln}>
            <span data-anim="heading-line" className={`${shellStyles.serif} ${styles.headingAccent}`}>
              {contact.heading[1]}
            </span>
          </span>
        </h2>

        <p className={styles.copy} data-anim="reveal">
          {contact.copy}
        </p>

        <div data-anim="reveal">
          <button className={styles.mail} type="button" onClick={copyEmail}>
            <span ref={emailRef}>{site.email}</span>{" "}
            <span className={`${shellStyles.note} ${styles.mailLabel}`}>
              {copied || "copy"}
            </span>
          </button>
          <span className="sr-only" aria-live="polite">
            {copied}
          </span>
        </div>

        <div className={`${shellStyles.note} ${styles.signature}`}>
          {contact.signature}{" "}
          <small className={`${shellStyles.mono} ${styles.signatureNote}`}>
            {contact.signatureNote}
          </small>
        </div>
      </div>

      <form className={styles.form} data-anim="reveal" onSubmit={onSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="f-name">{contact.labels.name}</label>
          <input
            id="f-name"
            name="name"
            autoComplete="name"
            maxLength={80}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby="e-name"
          />
          {errors.name ? (
            <span className={styles.err} id="e-name">
              {errors.name}
            </span>
          ) : null}
        </div>

        <div className={styles.field}>
          <label htmlFor="f-email">{contact.labels.email}</label>
          <input
            id="f-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            maxLength={200}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby="e-email"
          />
          {errors.email ? (
            <span className={styles.err} id="e-email">
              {errors.email}
            </span>
          ) : null}
        </div>

        <div className={styles.field}>
          <label htmlFor="f-msg">{contact.labels.message}</label>
          <textarea
            id="f-msg"
            name="message"
            rows={4}
            maxLength={2000}
            data-lenis-prevent
            aria-invalid={errors.message ? true : undefined}
            aria-describedby="e-msg"
          />
          {errors.message ? (
            <span className={styles.err} id="e-msg">
              {errors.message}
            </span>
          ) : null}
        </div>

        {/* Honeypot: hidden from people, filled in by most bots. */}
        <div className={styles.hp} aria-hidden="true">
          <label htmlFor="f-website">Website</label>
          <input id="f-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>

        <button className={`${shellStyles.btn} ${styles.send}`} type="submit" disabled={sending}>
          {sending ? "Sending…" : contact.submit}
        </button>

        <span
          className={`${styles.status}${
            status.kind === "ok"
              ? ` ${styles.statusOk}`
              : status.kind === "error"
                ? ` ${styles.statusError}`
                : ""
          }`}
          aria-live="polite"
        >
          {status.text}
        </span>
      </form>
    </div>
  );
}
