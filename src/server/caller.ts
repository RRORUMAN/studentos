import "server-only";

import { headers } from "next/headers";

import { currentUserId } from "@/server/viewer";

/**
 * ============================================================================
 * WHO IS ASKING
 * ----------------------------------------------------------------------------
 * The limiter key for a request, and nothing else.
 *
 * It lives in its own file rather than in `src/server/rate-limit.ts`, where it
 * is used, because that module is pure arithmetic over a Map and is unit
 * tested as such. `next/headers` is only resolvable inside a request, so
 * putting this beside the limiter made the whole limiter unimportable from the
 * test runner — the tests failed at module load with ERR_MODULE_NOT_FOUND
 * before a single assertion ran.
 *
 * A module that decides whether an attack gets through is a module worth being
 * able to test without a server.
 * ============================================================================
 */

/**
 * The signed-in user id where there is one, the forwarded client IP where
 * there is not, and a single shared bucket when there is neither — which is a
 * real limit rather than none.
 *
 * The unauthenticated endpoints all need the same answer: the two institution
 * lookups, and the waitlist, which had no limiter of any kind.
 */
export async function callerKey(): Promise<string> {
  const userId = await currentUserId();
  if (userId) return `user:${userId}`;

  /* First hop only. The header is a client-controlled list and every entry
     after the first was appended by a proxy the request already passed
     through, so taking the last would key on our own infrastructure. */
  const forwarded = (await headers()).get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first ? `ip:${first}` : "anonymous";
}
