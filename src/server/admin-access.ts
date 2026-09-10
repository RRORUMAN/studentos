/**
 * ============================================================================
 * WHO GETS THE ADMIN CONSOLE
 * ----------------------------------------------------------------------------
 * One pure function, deliberately in its own file.
 *
 * It lived in `src/server/viewer.ts` beside `requireAdmin`, which is where it
 * is used — and `viewer.ts` imports `next/navigation` for `redirect`, so the
 * whole module is unloadable outside a request and the decision could not be
 * unit tested at all. A rule that decides who reaches the admin console is
 * worth being able to test without a server.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT ENFORCES
 *
 * `ADMIN_EMAILS` names an address. It does not establish that the person
 * signed in controls it, and the grant used to be `allowlist.includes(email)`
 * and nothing else.
 *
 * Sign-up deliberately opens a session before the address is confirmed —
 * making a student verify before they can look around is the biggest drop-off
 * in a sign-up funnel, and a new account can do nothing sensitive. That last
 * clause stopped being true the moment an address could confer admin. An
 * ADMIN_EMAILS address that nobody had registered was a console waiting for
 * whoever typed it into the sign-up form first, and the addresses on that
 * list are a founder's: the most guessable string about a company.
 * ============================================================================
 */

export type AdminAccess = "granted" | "denied" | "unverified";

/**
 * Three outcomes rather than a boolean, because "you are the owner and your
 * address is unconfirmed" deserves a different answer from "no". That person
 * is almost always the real operator, and the useful reply to them is
 * "confirm the address" rather than a silent bounce.
 */
export function adminAccess(
  user: { isAdmin: boolean; email: string; emailVerifiedAt: string | null },
  allowlist: readonly string[],
): AdminAccess {
  /* The column is set by an operator against an account that already exists,
     so it already carries the proof the allowlist cannot. Requiring
     verification here too would lock out a promoted account on a deployment
     that cannot send mail — which is every deployment before Resend. */
  if (user.isAdmin) return "granted";

  if (!allowlist.includes(user.email.toLowerCase())) return "denied";
  return user.emailVerifiedAt ? "granted" : "unverified";
}
