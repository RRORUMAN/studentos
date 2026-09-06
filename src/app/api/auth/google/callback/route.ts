import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { completeGoogleSignIn, GOOGLE_STATE_COOKIE, isGoogleConfigured } from "@/server/auth/google";
import { upsertOAuthUser } from "@/server/auth/service";
import { createSession } from "@/server/auth/session";
import { findOne } from "@/server/db";

/**
 * Google sends the browser back here.
 *
 *   cancelled        → /login?google=cancelled  (nothing changed)
 *   invalid/expired  → /login?google=invalid
 *   ok, new email    → account created, → /onboarding
 *   ok, known email  → account linked (email verified by Google), → next or
 *                      /onboarding when they never finished setup
 *
 * No duplicate profiles: the account is found by normalised email and the
 * profile row is whatever already exists for that user id.
 */
export async function GET(request: Request): Promise<Response> {
  if (!isGoogleConfigured) return new Response("Google sign-in is not configured.", { status: 404 });

  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;

  const jar = await cookies();
  const raw = jar.get(GOOGLE_STATE_COOKIE)?.value;
  jar.delete(GOOGLE_STATE_COOKIE);

  type Expected = { state: string; verifier: string; nonce: string; next: string };
  let expected: Expected | null = null;
  try {
    expected = raw ? (JSON.parse(raw) as Expected) : null;
  } catch {
    expected = null;
  }

  const outcome = await completeGoogleSignIn({
    origin,
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
    error: url.searchParams.get("error"),
    expected,
  });

  if (!outcome.ok) {
    const reason = outcome.reason === "cancelled" ? "cancelled" : outcome.reason === "unverified-email" ? "unverified" : "invalid";
    return NextResponse.redirect(`${origin}/login?google=${reason}`);
  }

  const { userId } = await upsertOAuthUser({ email: outcome.identity.email });
  await createSession(userId, request.headers.get("user-agent"));

  const profile = await findOne("profiles", (row) => row.userId === userId);
  const next = profile?.onboardedAt ? (expected?.next ?? "/home") : "/onboarding";

  return NextResponse.redirect(`${origin}${next}`);
}
