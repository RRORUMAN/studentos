import "server-only";

import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

import { PASSWORD_MIN_LENGTH } from "@/config/auth";

/**
 * ============================================================================
 * AUTH CRYPTO
 * ----------------------------------------------------------------------------
 * Password hashing and token handling. Small, boring, and the one module in
 * the codebase where "clever" is a defect.
 *
 * Choices, and why:
 *
 *   scrypt over bcrypt/argon2  It is in Node's standard library. Adding a
 *                              native dependency to hash a password is a
 *                              supply-chain surface and a build problem on
 *                              every platform, in exchange for a difference
 *                              that does not matter at these parameters.
 *
 *   Opaque session tokens      The cookie holds 256 bits of randomness and the
 *                              database holds its SHA-256. Nothing is signed,
 *                              so there is no signing secret to rotate, leak or
 *                              forget to set in production. A stolen database
 *                              does not yield usable session cookies, and
 *                              revoking a session is a DELETE rather than a
 *                              blocklist.
 *
 *   SHA-256 for tokens         Correct *here* and nowhere else in this file: a
 *                              256-bit random token has no low-entropy
 *                              preimage to brute force, so the slow-hash
 *                              argument that governs passwords does not apply.
 *                              Passwords never touch this function.
 * ============================================================================
 */

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

/* -------------------------------------------------------------------------- */
/* Passwords                                                                   */
/* -------------------------------------------------------------------------- */

/** Node's default N=16384 costs ~50ms here, which is the right shape. */
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/**
 * Hash a password. Format is `scrypt$<salt-hex>$<key-hex>` — self-describing,
 * so a future migration to different parameters can detect and re-hash old
 * digests on next login rather than locking everyone out.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

/**
 * Verify a password against a stored digest.
 *
 * Always runs the KDF, even when the digest is missing or malformed. Returning
 * early on an unknown email turns login into an account-enumeration oracle
 * measurable over the network — a 50ms difference is trivially detectable.
 */
export async function verifyPassword(password: string, digest: string | null): Promise<boolean> {
  const parts = (digest ?? "").split("$");
  const usable = parts.length === 3 && parts[0] === "scrypt";

  /* A fixed dummy salt for the miss path, so the work is identical. */
  const salt = usable ? Buffer.from(parts[1], "hex") : Buffer.alloc(SALT_BYTES, 7);
  const expected = usable ? Buffer.from(parts[2], "hex") : Buffer.alloc(KEY_LENGTH, 9);

  let actual: Buffer;
  try {
    actual = await scrypt(password, salt, KEY_LENGTH);
  } catch {
    return false;
  }

  if (actual.length !== expected.length) return false;
  const matches = timingSafeEqual(actual, expected);
  return usable && matches;
}

/* -------------------------------------------------------------------------- */
/* Tokens                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A URL-safe random token. 32 bytes = 256 bits, which is past the point where
 * guessing is the attack anyone would choose.
 */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The value stored in the database. The plaintext lives only in the cookie. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time string compare for anything secret-shaped. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/* -------------------------------------------------------------------------- */
/* Password policy                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Defined in `@/config/auth` so the client forms can echo it without pulling
 * this `server-only` module into the browser bundle. Re-exported here because
 * enforcement lives on this side.
 */
export { PASSWORD_MIN_LENGTH } from "@/config/auth";

export type PasswordProblem = "too-short" | "too-common" | "contains-email";

/**
 * The top passwords by real-world breach frequency, prefix-matched. A short
 * embedded list catches the overwhelming majority of genuinely awful choices
 * without shipping a 100k-line file or calling an external service with a
 * user's password in the request.
 */
const COMMON = [
  "password",
  "123456",
  "qwerty",
  "letmein",
  "welcome",
  "admin",
  "iloveyou",
  "monkey",
  "dragon",
  "football",
  "abc123",
  "111111",
  "studentos",
];

export function checkPassword(password: string, email: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "too-short";

  const lower = password.toLowerCase();
  if (COMMON.some((common) => lower.includes(common))) return "too-common";

  const localPart = email.split("@")[0]?.toLowerCase();
  if (localPart && localPart.length >= 4 && lower.includes(localPart)) return "contains-email";

  return null;
}

export const passwordProblemMessage: Record<PasswordProblem, string> = {
  "too-short": `Use at least ${PASSWORD_MIN_LENGTH} characters. A few words together works well.`,
  "too-common": "That one turns up in breach lists. Try something less predictable.",
  "contains-email": "Do not put your email address in your password.",
};
