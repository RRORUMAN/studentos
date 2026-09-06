import { env } from "@/services/env";

/**
 * ============================================================================
 * MONITORING — Sentry
 * ----------------------------------------------------------------------------
 * Contract only. The SDK is installed in the product build; here the surface
 * exists so error boundaries and failed interactions already report through
 * one function rather than scattering console calls.
 *
 * Scrubbing rule: no budget amount and no coordinate is ever attached to an
 * error report. `scrub()` enforces it for the properties we do send.
 * ============================================================================
 */

type Context = Record<string, string | number | boolean | null | undefined>;

const FORBIDDEN_KEYS = ["lat", "lng", "coords", "balance", "amount", "budget", "email"];

function scrub(context?: Context): Context {
  if (!context) return {};
  return Object.fromEntries(
    Object.entries(context).filter(
      ([key]) => !FORBIDDEN_KEYS.some((forbidden) => key.toLowerCase().includes(forbidden)),
    ),
  );
}

export function captureError(error: unknown, context?: Context): void {
  const safe = scrub(context);

  if (env.sentry.dsn) {
    // Sentry.captureException(error, { extra: safe }) in the product build.
    return;
  }

  if (process.env.NODE_ENV === "development") {
    console.error("[monitoring]", error, safe);
  }
}

export function captureMessage(message: string, context?: Context): void {
  if (env.sentry.dsn) return;
  if (process.env.NODE_ENV === "development") {
    console.warn("[monitoring]", message, scrub(context));
  }
}
