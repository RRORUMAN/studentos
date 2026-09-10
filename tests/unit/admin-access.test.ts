import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { adminAccess } from "../../src/server/admin-access.ts";

/**
 * ============================================================================
 * AN ADDRESS IS NOT A PROOF THAT YOU OWN IT
 * ----------------------------------------------------------------------------
 * `requireAdmin` granted the console on `ADMIN_EMAILS.includes(email)` alone.
 *
 * Sign-up deliberately opens a session before the address is confirmed —
 * making a student verify before they can look around is the biggest drop-off
 * in a sign-up funnel, and a new account can do nothing sensitive. That last
 * clause stopped being true the moment an address could confer admin. So an
 * ADMIN_EMAILS address nobody had registered yet was a console waiting for
 * whoever typed it into the sign-up form first, and the addresses on that list
 * are a founder's — the most guessable string about a company.
 *
 * WHY THIS IS A UNIT TEST AND NOT AN E2E. It was written as an e2e first, and
 * that test passed against the BROKEN code. With no mail provider configured,
 * sign-up hands the verification token to the browser and redirects through
 * it, so a local account is verified seconds after creation and the gate looks
 * identical either way. The property only bites on a deployment that really
 * sends mail — the one place a test cannot reach. A test that cannot fail on
 * the old behaviour is not evidence, so the decision was made pure and the
 * whole matrix is here.
 * ============================================================================
 */

const LIST = ["founder@studentos.dev", "ops@studentos.dev"];

const user = (over: Partial<Parameters<typeof adminAccess>[0]> = {}) => ({
  isAdmin: false,
  email: "student@universidad.edu",
  emailVerifiedAt: null,
  ...over,
});

describe("who gets the admin console", () => {
  it("refuses an ordinary student, confirmed or not", () => {
    assert.equal(adminAccess(user(), LIST), "denied");
    assert.equal(adminAccess(user({ emailVerifiedAt: "2026-09-01T00:00:00Z" }), LIST), "denied");
  });

  it("refuses an allowlisted address that has not been confirmed", () => {
    /* THE ONE THAT WAS LIVE. Anybody who guessed the founder's address and
       signed up with it first held the console. */
    assert.equal(adminAccess(user({ email: "founder@studentos.dev" }), LIST), "unverified");
  });

  it("admits an allowlisted address once it is confirmed", () => {
    assert.equal(
      adminAccess(
        user({ email: "founder@studentos.dev", emailVerifiedAt: "2026-09-01T00:00:00Z" }),
        LIST,
      ),
      "granted",
    );
  });

  it("admits the database flag without asking about the address", () => {
    /* `isAdmin` is set by an operator against an account that already exists,
       so it already carries the proof the allowlist cannot. Requiring
       verification here too would lock out a promoted account on a deployment
       that cannot send mail — which is every deployment before Resend. */
    assert.equal(adminAccess(user({ isAdmin: true }), LIST), "granted");
    assert.equal(adminAccess(user({ isAdmin: true }), []), "granted");
  });

  it("matches the allowlist case-insensitively", () => {
    assert.equal(
      adminAccess(
        user({ email: "Founder@StudentOS.dev", emailVerifiedAt: "2026-09-01T00:00:00Z" }),
        LIST,
      ),
      "granted",
    );
  });

  it("grants nobody when the allowlist is empty", () => {
    assert.equal(adminAccess(user({ email: "founder@studentos.dev" }), []), "denied");
  });

  it("does not treat an empty address as a match for an empty entry", () => {
    /* `ADMIN_EMAILS=""` parses to a list, and a stray empty string in it
       against an empty email would be a match. Both halves are checked. */
    assert.equal(adminAccess(user({ email: "" }), [""]), "unverified");
    assert.equal(adminAccess(user({ email: "" }), []), "denied");
  });
});
