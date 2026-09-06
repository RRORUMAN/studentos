import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { beginGoogleSignIn, GOOGLE_STATE_COOKIE, isGoogleConfigured } from "@/server/auth/google";

/**
 * Start Google sign-in. Writes the state/PKCE cookie and redirects to Google.
 * Unconfigured deployments get a 404 rather than a half-working redirect.
 */
export async function GET(request: Request): Promise<Response> {
  if (!isGoogleConfigured) return new Response("Google sign-in is not configured.", { status: 404 });

  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;
  const requested = url.searchParams.get("next") ?? "/home";
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/home";

  const start = beginGoogleSignIn({ origin, next });

  const jar = await cookies();
  jar.set(GOOGLE_STATE_COOKIE, JSON.stringify(start.cookie), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  return NextResponse.redirect(start.url);
}
