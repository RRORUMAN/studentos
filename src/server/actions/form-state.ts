/**
 * Shared shape for `useActionState` forms.
 *
 * This lives outside the `"use server"` modules on purpose: a file with the
 * `"use server"` directive may only export async functions, so a constant or a
 * type declared alongside the actions fails the build with
 * `invalid-use-server-value`. Keeping them here lets both the action and the
 * client form import the same definitions.
 */

export type FormState = {
  ok: boolean;
  message: string | null;
  /** Which field to mark invalid, when the failure belongs to one. */
  field?: "email" | "password" | "confirm" | null;
  /** Set on success where the UI switches to a confirmation panel. */
  done?: boolean;
};

export const emptyFormState: FormState = { ok: false, message: null, field: null };
