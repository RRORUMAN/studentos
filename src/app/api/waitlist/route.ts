import { NextResponse } from "next/server";

import { getCity } from "@/data/cities";
import { findOne, insert, newId, nowIso, update } from "@/server/db";
import { sendTemplate } from "@/services/email";
import { isEphemeralStore } from "@/services/env";
import { callerKey } from "@/server/caller";
import { limits, rateLimitShared } from "@/server/rate-limit";
import { captureError } from "@/services/monitoring";

/**
 * ============================================================================
 * WAITLIST
 * ----------------------------------------------------------------------------
 * A real endpoint with real validation. It writes the row first and sends the
 * confirmation second, and it only answers `stored` once the row exists.
 *
 * That order is the whole point. An earlier version of this route sent the
 * email and returned `stored` while persisting nothing — a form that thanked a
 * student and discarded their address. The product is built on not telling
 * students something is true when it is not, and a waitlist that forgets you is
 * the smallest and most tempting version of exactly that.
 *
 * Where the row would not survive — a serverless instance with no database —
 * it returns `not-configured` instead, and the form says so and offers a route
 * that works.
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

  /* The question is not "is Supabase connected" but "will this row still be
     here tomorrow". A development machine writing to `.data/` is a real
     waitlist; a serverless instance writing to its own temp directory is a
     waitlist that a redeploy deletes, and promising somebody a place on that is
     the same lie as not storing them at all. */
  if (isEphemeralStore) {
    return NextResponse.json<WaitlistResponse>({ status: "not-configured" }, { status: 200 });
  }

  const address = email.trim().toLowerCase();

  /* ---- two limits, because this endpoint has two costs -------------------
     It is unauthenticated, it writes a row, and it sends a message to an
     address the request body names. Without a limiter that is an
     outbound-mail primitive somebody else can point at a third party, and it
     had none at all.

     PER CALLER bounds the writes. PER ADDRESS bounds the mail, and is the one
     that matters: the dedupe below is on (email, city) by design, so the same
     inbox can be enrolled once per city, and there are 261 cities.

     Shared rather than in-process, by this module's own rule — an
     unauthenticated path with a bill behind it — because a per-isolate
     counter on serverless is a limit an attacker sets by sending traffic.

     Both are checked before the insert, and the 429 says nothing about
     whether the address is already on the list. */
  const caller = await callerKey();
  const [byCaller, byAddress] = await Promise.all([
    rateLimitShared(`waitlist:${caller}`, limits.waitlist.limit, limits.waitlist.windowSeconds),
    rateLimitShared(
      `waitlist-address:${address}`,
      limits.waitlistAddress.limit,
      limits.waitlistAddress.windowSeconds,
    ),
  ]);

  const blocked = !byCaller.ok ? byCaller : !byAddress.ok ? byAddress : null;
  if (blocked) {
    return NextResponse.json<WaitlistResponse>(
      { status: "invalid", field: "email", message: "Too many requests. Try again later." },
      { status: 429, headers: { "retry-after": String(blocked.retryAfterSeconds) } },
    );
  }

  const citySlugValue = city?.slug ?? null;

  try {
    /* Asking twice is not an error, and it must not create a second row or a
       second email. Matched on the pair, so somebody who asked about Barcelona
       can still ask about Berlin. */
    const existing = await findOne(
      "waitlist",
      (row) => row.email === address && row.citySlug === citySlugValue,
    );

    const entry =
      existing ??
      (await insert("waitlist", {
        id: newId(),
        email: address,
        citySlug: citySlugValue,
        createdAt: nowIso(),
        notifiedAt: null,
      }));

    /* The row is what was promised; the email is a courtesy on top of it. A
       provider outage must not turn a stored signup into an error the student
       reads as "that did not work", so the send is allowed to fail on its own.
       `notifiedAt` stays null and names the ones to retry. */
    if (entry.notifiedAt === null) {
      const sent = await sendTemplate({
        to: address,
        template: "waitlist-confirmed",
        data: { city: city?.name ?? "your city" },
      });

      /* Stamped only on a real send. `sendTemplate` reports failure in its
         return value rather than throwing, so writing the timestamp
         unconditionally would record a confirmation that never left the
         building — and this column is what a later retry reads to decide who
         still needs one. */
      if (sent.ok) {
        await update("waitlist", (row) => row.id === entry.id, { notifiedAt: nowIso() });
      }
    }

    return NextResponse.json<WaitlistResponse>({
      status: "stored",
      city: city?.name ?? "your city",
    });
  } catch (error) {
    /* The row could not be written, so nothing was promised. Saying
       `not-configured` is honest here: from the student's side the waitlist is
       not working, and the form offers them a route that is. */
    captureError(error, { route: "waitlist", stage: "store" });
    return NextResponse.json<WaitlistResponse>({ status: "not-configured" }, { status: 200 });
  }
}
