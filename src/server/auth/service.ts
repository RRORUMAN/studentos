import "server-only";

import {
  checkPassword,
  hashPassword,
  hashToken,
  newToken,
  passwordProblemMessage,
  verifyPassword,
} from "@/server/auth/crypto";
import { destroyAllSessions } from "@/server/auth/session";
import { findOne, insert, newId, nowIso, remove, update } from "@/server/db";
import { limits, rateLimit, resetLimit } from "@/server/rate-limit";
import { absoluteUrl, sendTemplate } from "@/services/email";
import type { AuthToken, User } from "@/domain/types";

/**
 * ============================================================================
 * AUTH SERVICE
 * ----------------------------------------------------------------------------
 * Sign-up, sign-in, verification and password reset.
 *
 * The behaviour that governs every function here: **never confirm whether an
 * email address has an account.** Sign-up with an existing address, a reset
 * request for an unknown address and a login with a wrong password all return
 * the same shape and take a comparable amount of time. An account-existence
 * oracle is how a leaked email list becomes a targeted phishing list, and it
 * is worth the small UX cost of "check your email" being occasionally
 * uninformative.
 *
 * The one deliberate exception is a *wrong password on a known account*, which
 * returns "invalid-credentials" identically to an unknown account — the
 * distinction is never surfaced.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Results                                                                     */
/* -------------------------------------------------------------------------- */

export type AuthResult =
  | { ok: true; userId: string; needsVerification: boolean }
  | { ok: false; error: AuthError; message: string; retryAfterSeconds?: number };

export type AuthError =
  | "invalid-email"
  | "weak-password"
  | "invalid-credentials"
  | "rate-limited"
  | "expired-token"
  | "unknown";

/* -------------------------------------------------------------------------- */
/* Email                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Practical validation, not RFC 5322. The full grammar accepts addresses no
 * mail provider will deliver to, and a stricter regex rejects real addresses;
 * the actual proof that an address works is the verification email.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email) && email.length <= 254;
}

/**
 * University email domains earn the Student Verified badge automatically.
 * A short suffix list rather than a service: `.edu`, `.ac.uk`, `.edu.au` and
 * friends cover most of the world's universities, and anything else goes
 * through manual verification rather than being wrongly rejected.
 */
const ACADEMIC_SUFFIXES = [
  ".edu",
  ".ac.uk",
  ".edu.au",
  ".ac.nz",
  ".edu.sg",
  ".ac.jp",
  ".edu.cn",
  ".ac.in",
  ".edu.br",
  ".ac.za",
  ".uni-",
  ".univ-",
];

export function looksAcademic(email: string): boolean {
  const domain = email.split("@")[1] ?? "";
  return ACADEMIC_SUFFIXES.some((suffix) =>
    suffix.startsWith(".uni-") || suffix.startsWith(".univ-")
      ? domain.includes(suffix.slice(1))
      : domain.endsWith(suffix),
  );
}

/* -------------------------------------------------------------------------- */
/* Tokens                                                                      */
/* -------------------------------------------------------------------------- */

const TOKEN_TTL_MINUTES = { "verify-email": 60 * 24 * 3, "reset-password": 60, "magic-link": 15 };

async function issueToken(userId: string, kind: AuthToken["kind"]): Promise<string> {
  /* One live token per purpose. Issuing a second reset link must invalidate
     the first, or a forwarded old email stays usable. */
  await remove("authTokens", (row) => row.userId === userId && row.kind === kind);

  const token = newToken();
  await insert("authTokens", {
    tokenHash: hashToken(token),
    userId,
    kind,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES[kind] * 60_000).toISOString(),
    consumedAt: null,
    createdAt: nowIso(),
  });
  return token;
}

async function consumeToken(
  token: string,
  kind: AuthToken["kind"],
): Promise<{ ok: true; userId: string } | { ok: false }> {
  const row = await findOne(
    "authTokens",
    (candidate) => candidate.tokenHash === hashToken(token) && candidate.kind === kind,
  );

  if (!row || row.consumedAt || Date.parse(row.expiresAt) <= Date.now()) return { ok: false };

  await update("authTokens", (candidate) => candidate.tokenHash === row.tokenHash, {
    consumedAt: nowIso(),
  });

  return { ok: true, userId: row.userId };
}

/* -------------------------------------------------------------------------- */
/* Sign up                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Create an account.
 *
 * On a duplicate address this returns `ok: true` and silently sends a "someone
 * tried to sign up with your address" email to the existing account instead of
 * creating anything. The caller shows "check your email" either way, so the
 * form cannot be used to test which addresses are registered.
 */
export async function signUp(input: {
  email: string;
  password: string;
}): Promise<AuthResult & { verifyToken?: string }> {
  const email = normaliseEmail(input.email);

  if (!isValidEmail(email)) {
    return { ok: false, error: "invalid-email", message: "That email address does not look right." };
  }

  const gate = rateLimit(`signup:${email}`, limits.authSignup.limit, limits.authSignup.windowSeconds);
  if (!gate.ok) {
    return {
      ok: false,
      error: "rate-limited",
      message: "Too many attempts. Try again shortly.",
      retryAfterSeconds: gate.retryAfterSeconds,
    };
  }

  const problem = checkPassword(input.password, email);
  if (problem) {
    return { ok: false, error: "weak-password", message: passwordProblemMessage[problem] };
  }

  const existing = await findOne("users", (row) => row.email === email);
  if (existing) {
    /* Do the hash anyway so the timing matches the create path, then tell the
       real owner rather than the person at the keyboard. */
    await hashPassword(input.password);
    await sendTemplate({
      to: email,
      template: "duplicate-signup",
      data: { url: absoluteUrl("/signin") ?? "" },
    });
    return { ok: true, userId: existing.id, needsVerification: !existing.emailVerifiedAt };
  }

  const user: User = {
    id: newId(),
    email,
    passwordHash: await hashPassword(input.password),
    emailVerifiedAt: null,
    provider: "password",
    createdAt: nowIso(),
    lastSeenAt: nowIso(),
    isAdmin: false,
  };

  await insert("users", user);
  const verifyToken = await issueToken(user.id, "verify-email");

  /* Send the link, and only hand it back to the caller when sending failed.
     `verifyToken` is what the sign-up action redirects through, so returning it
     unconditionally means every new account verifies itself the moment it is
     created — which is the correct behaviour on a laptop with no email provider
     and a hole in production, because it makes the address on the account
     unproven while the product treats it as proven.

     A deployment with a key and a verified domain therefore never takes that
     path; one without a key keeps working exactly as it does today, and
     `/admin` → Services says plainly which of the two it is. */
  const link = absoluteUrl(`/verify-email?token=${encodeURIComponent(verifyToken)}&next=/onboarding`);
  const sent = link
    ? await sendTemplate({ to: email, template: "verify-email", data: { url: link } })
    : ({ ok: false, reason: "no-site-url" } as const);

  return {
    ok: true,
    userId: user.id,
    needsVerification: true,
    verifyToken: sent.ok ? undefined : verifyToken,
  };
}

/* -------------------------------------------------------------------------- */
/* Sign in                                                                     */
/* -------------------------------------------------------------------------- */

export async function signIn(input: { email: string; password: string }): Promise<AuthResult> {
  const email = normaliseEmail(input.email);

  const gate = rateLimit(`signin:${email}`, limits.authAttempt.limit, limits.authAttempt.windowSeconds);
  if (!gate.ok) {
    return {
      ok: false,
      error: "rate-limited",
      message: "Too many attempts. Try again in a few minutes.",
      retryAfterSeconds: gate.retryAfterSeconds,
    };
  }

  const user = await findOne("users", (row) => row.email === email);

  /* `verifyPassword` runs the KDF even with a null digest, so the unknown-email
     path costs the same as the wrong-password path. */
  const valid = await verifyPassword(input.password, user?.passwordHash ?? null);

  if (!user || !valid) {
    return {
      ok: false,
      error: "invalid-credentials",
      message: "That email and password do not match.",
    };
  }

  resetLimit(`signin:${email}`);
  await update("users", (row) => row.id === user.id, { lastSeenAt: nowIso() });

  return { ok: true, userId: user.id, needsVerification: !user.emailVerifiedAt };
}

/* -------------------------------------------------------------------------- */
/* Verify email                                                                */
/* -------------------------------------------------------------------------- */

export async function verifyEmail(token: string): Promise<AuthResult> {
  const result = await consumeToken(token, "verify-email");
  if (!result.ok) {
    return {
      ok: false,
      error: "expired-token",
      message: "That link has expired. Request a new one.",
    };
  }

  const user = await update("users", (row) => row.id === result.userId, {
    emailVerifiedAt: nowIso(),
  });
  if (!user) return { ok: false, error: "unknown", message: "Something went wrong." };

  return { ok: true, userId: user.id, needsVerification: false };
}

/** Re-issue a verification link. */
export async function resendVerification(userId: string): Promise<string | null> {
  const user = await findOne("users", (row) => row.id === userId);
  if (!user || user.emailVerifiedAt) return null;

  const gate = rateLimit(`verify:${userId}`, limits.passwordReset.limit, limits.passwordReset.windowSeconds);
  if (!gate.ok) return null;

  return issueToken(userId, "verify-email");
}

/* -------------------------------------------------------------------------- */
/* Password reset                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Request a reset link.
 *
 * Always reports success. The returned token is null for an unknown address,
 * and the caller renders the same screen either way.
 */
export async function requestPasswordReset(
  emailInput: string,
): Promise<{ ok: true; token: string | null }> {
  const email = normaliseEmail(emailInput);

  const gate = rateLimit(`reset:${email}`, limits.passwordReset.limit, limits.passwordReset.windowSeconds);
  if (!gate.ok) return { ok: true, token: null };

  const user = await findOne("users", (row) => row.email === email);
  if (!user) return { ok: true, token: null };

  const token = await issueToken(user.id, "reset-password");

  /* Same rule as verification, and it matters more here: a reset link shown on
     screen to whoever typed the address is a way to take over an account by
     knowing an email address. Handed back only when it could not be sent. */
  const link = absoluteUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  const sent = link
    ? await sendTemplate({ to: email, template: "reset-password", data: { url: link } })
    : ({ ok: false, reason: "no-site-url" } as const);

  return { ok: true, token: sent.ok ? null : token };
}

/**
 * Complete a reset.
 *
 * Every other session is destroyed on success. If the reset was triggered
 * because someone else had access, leaving their session alive would make the
 * whole exercise pointless.
 */
export async function resetPassword(input: {
  token: string;
  password: string;
}): Promise<AuthResult> {
  const result = await consumeToken(input.token, "reset-password");
  if (!result.ok) {
    return {
      ok: false,
      error: "expired-token",
      message: "That reset link has expired. Request a new one.",
    };
  }

  const user = await findOne("users", (row) => row.id === result.userId);
  if (!user) return { ok: false, error: "unknown", message: "Something went wrong." };

  const problem = checkPassword(input.password, user.email);
  if (problem) {
    return { ok: false, error: "weak-password", message: passwordProblemMessage[problem] };
  }

  await update("users", (row) => row.id === user.id, {
    passwordHash: await hashPassword(input.password),
    /* Completing a reset proves control of the mailbox, so verify at the same
       time rather than sending a second email for the same evidence. */
    emailVerifiedAt: user.emailVerifiedAt ?? nowIso(),
  });

  await destroyAllSessions(user.id);

  return { ok: true, userId: user.id, needsVerification: false };
}

/* -------------------------------------------------------------------------- */
/* OAuth                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Find or create an account for a verified OAuth identity.
 *
 * Only ever called with an email the provider has already verified — the
 * provider's assertion is what replaces the verification email, so this must
 * never be reachable from user-supplied input.
 */
export async function upsertOAuthUser(input: { email: string }): Promise<{ userId: string }> {
  const email = normaliseEmail(input.email);
  const existing = await findOne("users", (row) => row.email === email);
  if (existing) {
    await update("users", (row) => row.id === existing.id, {
      lastSeenAt: nowIso(),
      emailVerifiedAt: existing.emailVerifiedAt ?? nowIso(),
    });
    return { userId: existing.id };
  }

  const user: User = {
    id: newId(),
    email,
    passwordHash: null,
    emailVerifiedAt: nowIso(),
    provider: "google",
    createdAt: nowIso(),
    lastSeenAt: nowIso(),
    isAdmin: false,
  };
  await insert("users", user);
  return { userId: user.id };
}
