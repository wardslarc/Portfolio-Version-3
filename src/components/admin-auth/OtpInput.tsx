"use client";

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import styles from "./AuthShell.module.css";

const BOX_COUNT = 6;

export function extractLastDigit(value: string): string {
  return value.replace(/\D/g, "").slice(-1);
}

/**
 * Spreads pasted/autofilled text across up to 6 digit slots.
 * Returns null when the input contains no digits.
 */
export function spreadOtpDigits(text: string): string[] | null {
  const clean = text.replace(/\D/g, "").slice(0, BOX_COUNT);
  if (!clean) return null;
  return Array.from({ length: BOX_COUNT }, (_, i) => clean[i] ?? "");
}

export default function OtpInput() {
  const [digits, setDigits] = useState<string[]>(() => Array(BOX_COUNT).fill(""));
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const focusBox = (index: number) => {
    const clamped = Math.max(0, Math.min(BOX_COUNT - 1, index));
    refs.current[clamped]?.focus();
  };

  const handleChange = (index: number, raw: string) => {
    const onlyDigits = raw.replace(/\D/g, "");
    if (onlyDigits.length > 1) {
      const spread = spreadOtpDigits(onlyDigits);
      if (!spread) return;
      setDigits(spread);
      const nextEmpty = spread.findIndex((d) => !d);
      focusBox(nextEmpty === -1 ? BOX_COUNT - 1 : nextEmpty);
      return;
    }

    const digit = extractLastDigit(raw);
    setDigits((prev) => {
      const next = prev.slice();
      next[index] = digit;
      return next;
    });
    if (digit && index < BOX_COUNT - 1) {
      focusBox(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      focusBox(index - 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const spread = spreadOtpDigits(e.clipboardData.getData("text") || "");
    if (!spread) return;
    e.preventDefault();
    setDigits(spread);
    const nextEmpty = spread.findIndex((d) => !d);
    focusBox(nextEmpty === -1 ? BOX_COUNT - 1 : nextEmpty);
  };

  return (
    <fieldset className={styles.otpFieldset}>
      <legend className={styles.otpLegend}>6-digit code</legend>
      <input type="hidden" name="code" value={digits.join("")} />
      <div className={styles.digits}>
        {digits.map((val, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            autoComplete={i === 0 ? "one-time-code" : "off"}
            autoFocus={i === 0}
            aria-label={`Digit ${i + 1} of 6`}
            value={val}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className={`${styles.digit} k-in-pop${val ? ` ${styles.digitFilled}` : ""}`}
            style={{ animationDelay: `${(0.75 + i * 0.06).toFixed(2)}s` }}
          />
        ))}
      </div>
    </fieldset>
  );
}
