"use client";

import { useState } from "react";

/**
 * Returns alternating shake class names ("k-shakeA" / "k-shakeB") each time a
 * new error arrives, and "" when there is no error.
 */
export function useShake(
  error: string | null | undefined,
  trigger?: unknown,
): string {
  const [state, setState] = useState<{
    error: string | null | undefined;
    trigger: unknown;
    parity: 0 | 1 | 2;
  }>({
    error,
    trigger,
    parity: error ? 1 : 0,
  });

  if (error !== state.error || trigger !== state.trigger) {
    setState({
      error,
      trigger,
      parity: error ? (state.parity === 1 ? 2 : 1) : 0,
    });
  }

  if (!error || state.parity === 0) return "";
  return state.parity === 1 ? "k-shakeA" : "k-shakeB";
}
