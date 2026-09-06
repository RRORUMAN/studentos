import "server-only";

import { cache } from "react";

/**
 * ============================================================================
 * REQUEST CLOCK
 * ----------------------------------------------------------------------------
 * One "now" per request.
 *
 * Calling `Date.now()` inside a component body makes render non-idempotent:
 * React may render a tree more than once, and two components in the same tree
 * can disagree about the time by a few milliseconds — which is how a list ends
 * up saying "2m ago" next to "1m ago" for the same timestamp.
 *
 * `cache` pins the value for the lifetime of the request, so every component in
 * one render agrees, and the call is a stable function rather than an impure
 * global read.
 * ============================================================================
 */
export const requestNow = cache((): number => Date.now());

/** The same instant as a `Date`, for the engines that take one. */
export const requestDate = cache((): Date => new Date(requestNow()));

/**
 * Minutes since an ISO timestamp, measured against the request clock.
 *
 * Components pass the result to `ago()` for formatting rather than computing
 * the elapsed time themselves.
 */
export function minutesSince(iso: string): number {
  return (requestNow() - Date.parse(iso)) / 60_000;
}
