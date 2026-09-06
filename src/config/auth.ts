/**
 * Auth constants shared by the client forms and the server policy.
 *
 * This module exists so a client component can render "12+ characters" without
 * importing `server/auth/crypto.ts`, which is `server-only` and would drag
 * `node:crypto` into the browser bundle. The server still owns enforcement —
 * this file holds only the numbers the UI has to echo.
 */

/**
 * Length-first, deliberately. Composition rules ("one uppercase, one symbol")
 * push people towards `Password1!` and are worse than a length floor by every
 * measure anyone has published. Twelve is enough to matter and short enough
 * that a real passphrase clears it.
 */
export const PASSWORD_MIN_LENGTH = 12;

/** How long a reset link stays usable, in minutes. Echoed in the email copy. */
export const RESET_TOKEN_MINUTES = 60;
