import "server-only";

import { cookies } from "next/headers";

import { hashToken, newToken } from "@/server/auth/crypto";
import { findOne, insert, newId, nowIso, remove, update } from "@/server/db";
import type { Session, User } from "@/domain/types";

/**
 * ============================================================================
 * SESSIONS
 * ----------------------------------------------------------------------------
 * Cookie handling and session lifecycle. The cookie carries an opaque token;
 * everything else about the session lives in the database.
 *
 * Cookie flags, and why each one is not negotiable:
 *
 *   httpOnly   JavaScript cannot read it, so an XSS bug cannot exfiltrate a
 *              session. This is the single highest-value flag on the list.
 *   secure     HTTPS only, except on localhost where there is no certificate
 *              and the flag would simply prevent development from working.
 *   sameSite   "lax" — sends the cookie on top-level navigations (so a link
 *              from an email lands the student signed in) but not on
 *              cross-site POSTs, which is the CSRF vector that matters. Server
 *              Actions add their own origin check on top.
 *   path "/"   The session is the whole product.
 * ============================================================================
 */

const COOKIE_NAME = "studentos_session";

/**
 * Thirty days, refreshed on use. Long enough that a student who opens the app
 * twice a week is never signed out; short enough that an abandoned laptop
 * session does not live forever.
 */
const SESSION_DAYS = 30;
/** Refresh the expiry when less than this remains, so writes stay rare. */
const REFRESH_THRESHOLD_DAYS = 7;

const DAY_MS = 86_400_000;

function expiryFromNow(days = SESSION_DAYS): string {
  return new Date(Date.now() + days * DAY_MS).toISOString();
}

/* -------------------------------------------------------------------------- */
/* Create / destroy                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Start a session and set the cookie. Returns the session row.
 *
 * Called from a Server Action or Route Handler only — `cookies()` is not
 * writable during a page render, which is a Next.js constraint rather than a
 * choice, and the reason sign-in is an action rather than a page effect.
 */
export async function createSession(userId: string, userAgent?: string | null): Promise<Session> {
  const token = newToken();
  const session: Session = {
    id: newId(),
    tokenHash: hashToken(token),
    userId,
    expiresAt: expiryFromNow(),
    userAgent: userAgent?.slice(0, 200) ?? null,
    createdAt: nowIso(),
  };

  await insert("sessions", session);

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(session.expiresAt),
  });

  return session;
}

/** End the current session: delete the row, then clear the cookie. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;

  if (token) {
    /* Delete server-side first. If the cookie clear somehow fails, the token is
       already dead — the reverse order would leave a live session with no way
       for the student to reach it. */
    await remove("sessions", (row) => row.tokenHash === hashToken(token));
  }

  jar.delete(COOKIE_NAME);
}

/** Revoke every session for a user. Used on password reset. */
export async function destroyAllSessions(userId: string): Promise<number> {
  return remove("sessions", (row) => row.userId === userId);
}

/* -------------------------------------------------------------------------- */
/* Read                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Resolve the signed-in user from the cookie, or null.
 *
 * Safe to call from a page render: it only reads. The sliding-expiry refresh
 * is deliberately *not* done here for that reason — a write during render
 * would throw in Next.js. `touchSession` handles it from actions instead.
 */
export async function readSession(): Promise<{ session: Session; user: User } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await findOne("sessions", (row) => row.tokenHash === hashToken(token));
  if (!session) return null;

  if (Date.parse(session.expiresAt) <= Date.now()) {
    /* Expired rows are cleaned up lazily on the next read rather than by a
       cron. The row is already useless; this just stops the table growing. */
    await remove("sessions", (row) => row.id === session.id);
    return null;
  }

  const user = await findOne("users", (row) => row.id === session.userId);
  if (!user) return null;

  return { session, user };
}

/**
 * Extend a session that is close to expiring. Call from actions, never from a
 * render. No-op when there is plenty of time left, so a busy student is not
 * generating a database write on every click.
 */
export async function touchSession(): Promise<void> {
  const current = await readSession();
  if (!current) return;

  const remaining = Date.parse(current.session.expiresAt) - Date.now();
  if (remaining > REFRESH_THRESHOLD_DAYS * DAY_MS) return;

  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return;

  const expiresAt = expiryFromNow();
  await update("sessions", (row) => row.id === current.session.id, { expiresAt });

  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export const sessionCookieName = COOKIE_NAME;
