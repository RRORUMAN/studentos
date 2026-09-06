"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { captureError } from "@/services/monitoring";

/**
 * Clipboard with a fallback for browsers and contexts where the async API is
 * unavailable (older Safari, non-secure origins). Returns whether it worked so
 * the caller can show a real result rather than an optimistic one.
 */
export function useCopy(resetAfterMs = 2000) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      let ok = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          ok = true;
        } else {
          const field = document.createElement("textarea");
          field.value = text;
          field.setAttribute("readonly", "");
          field.style.position = "fixed";
          field.style.opacity = "0";
          document.body.appendChild(field);
          field.select();
          ok = document.execCommand("copy");
          document.body.removeChild(field);
        }
      } catch (error) {
        captureError(error, { action: "clipboard-copy" });
        ok = false;
      }

      if (ok) {
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), resetAfterMs);
      }
      return ok;
    },
    [resetAfterMs],
  );

  return { copy, copied };
}
