import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { env } from "@/services/env";

/**
 * ============================================================================
 * GOOGLE SIGN-IN
 * ----------------------------------------------------------------------------
 * OAuth 2.0 authorization-code flow with PKCE against Google's endpoints,
 * done with `fetch` — the three requests it needs do not justify a dependency.
 *
 * Nothing here is reachable unless `GOOGLE_CLIENT_ID` and
 * `GOOGLE_CLIENT_SECRET` are set: `isGoogleConfigured` gates the button and
 * both route handlers, so an unconfigured deployment shows an honest note
 * rather than a button that 500s.
 *
 * Security properties, each one a class of bug it prevents:
 *
 *   state      random, stored in an httpOnly cookie, compared on return —
 *              a forged callback cannot sign someone into an attacker's account
 *   PKCE       code_verifier in the same cookie, code_challenge in the URL —
 *              an intercepted code is useless without the verifier
 *   nonce      bound into the id_token and checked — replayed tokens fail
 *   email_verified   an unverified Google email is refused; we do not link an
 *              account on an address Google itself has not confirmed
 *
 * With Supabase configured, the same flow is available through Supabase Auth
 * (`signInWithOAuth({ provider: "google" })`); the callback URL and env names
 * are documented in the README so switching is a config change.
 * ============================================================================
 */

export const isGoogleConfigured = Boolean(env.google.clientId && env.google.clientSecret);

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export const GOOGLE_STATE_COOKIE = "studentos_google_oauth";

function base64url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type GoogleStart = {
  url: string;
  /** Serialised into the state cookie. */
  cookie: { state: string; verifier: string; nonce: string; next: string };
};

export function beginGoogleSignIn(input: { origin: string; next: string }): GoogleStart {
  const state = base64url(randomBytes(24));
  const verifier = base64url(randomBytes(48));
  const nonce = base64url(randomBytes(16));
  const challenge = base64url(createHash("sha256").update(verifier).digest());

  const params = new URLSearchParams({
    client_id: env.google.clientId ?? "",
    redirect_uri: `${input.origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    access_type: "online",
    prompt: "select_account",
  });

  return { url: `${AUTH_URL}?${params}`, cookie: { state, verifier, nonce, next: input.next } };
}

export type GoogleIdentity = { email: string; name: string | null; sub: string };

export type GoogleOutcome =
  | { ok: true; identity: GoogleIdentity }
  | { ok: false; reason: "cancelled" | "invalid-state" | "exchange-failed" | "unverified-email" | "expired" };

/**
 * Finish the flow: exchange the code, read the identity, verify it.
 *
 * `expected` is the cookie written by `beginGoogleSignIn`. A mismatch on state
 * is a forged or stale callback and is refused without touching Google.
 */
export async function completeGoogleSignIn(input: {
  origin: string;
  code: string | null;
  state: string | null;
  error: string | null;
  expected: { state: string; verifier: string; nonce: string } | null;
}): Promise<GoogleOutcome> {
  if (input.error === "access_denied") return { ok: false, reason: "cancelled" };
  if (!input.expected) return { ok: false, reason: "expired" };
  if (!input.code || !input.state || input.state !== input.expected.state) {
    return { ok: false, reason: "invalid-state" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const tokenResponse = await fetch(TOKEN_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: input.code,
        client_id: env.google.clientId ?? "",
        client_secret: env.google.clientSecret ?? "",
        redirect_uri: `${input.origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
        code_verifier: input.expected.verifier,
      }),
    });
    if (!tokenResponse.ok) return { ok: false, reason: "exchange-failed" };

    const tokens = (await tokenResponse.json()) as { access_token?: string; id_token?: string };
    if (!tokens.access_token || !tokens.id_token) return { ok: false, reason: "exchange-failed" };

    /* The nonce lives in the id_token payload. Decoding the middle segment is
       enough to check it — the token came straight from Google over TLS in
       response to our own code exchange, so its signature is not the question. */
    const payload = JSON.parse(Buffer.from(tokens.id_token.split(".")[1] ?? "", "base64url").toString("utf8")) as {
      nonce?: string;
    };
    if (payload.nonce !== input.expected.nonce) return { ok: false, reason: "invalid-state" };

    const infoResponse = await fetch(USERINFO_URL, {
      signal: controller.signal,
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });
    if (!infoResponse.ok) return { ok: false, reason: "exchange-failed" };

    const info = (await infoResponse.json()) as {
      sub: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
    };

    if (!info.email || info.email_verified !== true) return { ok: false, reason: "unverified-email" };

    return { ok: true, identity: { email: info.email, name: info.name ?? null, sub: info.sub } };
  } catch {
    return { ok: false, reason: "exchange-failed" };
  } finally {
    clearTimeout(timeout);
  }
}
