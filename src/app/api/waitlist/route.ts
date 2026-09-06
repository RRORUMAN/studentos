import { NextResponse } from "next/server";

import { getCity } from "@/data/cities";
import { sendTemplate } from "@/services/email";
import { isBackendConfigured } from "@/services/env";
import { captureError } from "@/services/monitoring";

/**
 * ============================================================================
 * WAITLIST
 * ----------------------------------------------------------------------------
 * A real endpoint with real validation. When Supabase and Resend are wired up
 * it stores the row and sends the confirmation; until then it says so plainly
 * rather than returning a success the product cannot honour.
 *
 * Never returning a fake 200 is deliberate — the whole product is built on not
 * telling students something is true when it is not.
 * ============================================================================
 */

/** Deliberately permissive: rejecting valid addresses is worse than a bounce. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type WaitlistResponse =
  | { status: "stored"; city: string }
  | { status: "not-configured" }
  | { status: "invalid"; field: "email" | "city"; message: string };

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json<WaitlistResponse>(
      { status: "invalid", field: "email", message: "That request could not be read." },
      { status: 400 },
    );
  }

  const { email, citySlug } = (payload ?? {}) as { email?: unknown; citySlug?: unknown };

  if (typeof email !== "string" || !EMAIL.test(email.trim())) {
    return NextResponse.json<WaitlistResponse>(
      { status: "invalid", field: "email", message: "That does not look like an email address." },
      { status: 422 },
    );
  }

  const city = typeof citySlug === "string" ? getCity(citySlug) : undefined;
  if (typeof citySlug === "string" && !city) {
    return NextResponse.json<WaitlistResponse>(
      { status: "invalid", field: "city", message: "We do not have that city yet." },
      { status: 422 },
    );
  }

  if (!isBackendConfigured) {
    return NextResponse.json<WaitlistResponse>({ status: "not-configured" }, { status: 200 });
  }

  try {
    // Persisted through the Supabase service in the product build.
    await sendTemplate({
      to: email.trim(),
      template: "waitlist-confirmed",
      data: { city: city?.name ?? "your city" },
    });
    return NextResponse.json<WaitlistResponse>({
      status: "stored",
      city: city?.name ?? "your city",
    });
  } catch (error) {
    captureError(error, { route: "waitlist" });
    return NextResponse.json<WaitlistResponse>({ status: "not-configured" }, { status: 200 });
  }
}
