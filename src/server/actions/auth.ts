"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";

import {
  requestPasswordReset,
  resendVerification,
  resetPassword,
  signIn,
  signUp,
  verifyEmail,
} from "@/server/auth/service";
import { createSession, destroySession, readSession } from "@/server/auth/session";
import { PASSWORD_MIN_LENGTH } from "@/config/auth";
import type { FormState } from "@/server/actions/form-state";

/**
 * ============================================================================
 * AUTH ACTIONS
 * ----------------------------------------------------------------------------
 * The Server Action layer over `server/auth/service.ts`. These do three things
 * and nothing else: validate the form, call the service, set or clear the
 * cookie.
 *
 * On the verification link: with nothing able to send email, `signUp` returns
 * the token and this layer redirects straight to it, so the flow can be walked
 * on a laptop with zero configuration. That gate lives in the service and is
 * **not** "is there a Resend key" — this layer used to read `process.env`
 * directly to decide, which put a live token in a URL on any deployment whose
 * key was missing, expired or rejected. The service answers with a `delivery`
 * instead, and a hosted deployment never gets a token to redirect through.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Schemas                                                                     */
/* -------------------------------------------------------------------------- */

const credentials = z.object({
  email: z.string().trim().min(1, "Enter your email address.").max(254),
  password: z.string().min(1, "Enter your password."),
});

const signUpSchema = credentials
  .extend({
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: "Those two passwords do not match.",
    path: ["confirm"],
  });

function firstIssue(error: z.ZodError): FormState {
  const issue = error.issues[0];
  const path = issue?.path[0];
  return {
    ok: false,
    message: issue?.message ?? "Check the form and try again.",
    field: path === "email" || path === "password" || path === "confirm" ? path : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Sign up                                                                     */
/* -------------------------------------------------------------------------- */

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) return firstIssue(parsed.error);

  const result = await signUp({ email: parsed.data.email, password: parsed.data.password });

  if (!result.ok) {
    return {
      ok: false,
      message: result.message,
      field: result.error === "weak-password" ? "password" : "email",
    };
  }

  /* A brand-new account is signed in immediately. Making a student verify
     their email *before* they can look around is the single biggest drop-off
     in a sign-up funnel, and the account can do nothing sensitive until
     onboarding is finished anyway. */
  const agent = (await headers()).get("user-agent");
  await createSession(result.userId, agent);

  if (result.verifyToken) {
    redirect(`/verify-email?token=${encodeURIComponent(result.verifyToken)}&next=/onboarding`);
  }

  redirect("/onboarding");
}

/* -------------------------------------------------------------------------- */
/* Sign in                                                                     */
/* -------------------------------------------------------------------------- */

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return firstIssue(parsed.error);

  const result = await signIn(parsed.data);

  if (!result.ok) {
    return { ok: false, message: result.message, field: "password" };
  }

  const agent = (await headers()).get("user-agent");
  await createSession(result.userId, agent);

  /* `next` is validated as a same-origin path. An open redirect on a login
     form is the classic way a phishing page borrows your domain. */
  const requested = String(formData.get("next") ?? "");
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/home";

  redirect(next);
}

/* -------------------------------------------------------------------------- */
/* Sign out                                                                    */
/* -------------------------------------------------------------------------- */

export async function signOutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}

/* -------------------------------------------------------------------------- */
/* Password reset                                                              */
/* -------------------------------------------------------------------------- */

export async function requestResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, message: "Enter your email address.", field: "email" };

  const { token, delivery } = await requestPasswordReset(email);

  /* Zero-configuration affordance, decided by the service — see the module
     header. A hosted deployment never reaches this with a token. */
  if (token && delivery === "shown") {
    redirect(`/reset-password?token=${encodeURIComponent(token)}`);
  }

  /* No mail provider on a deployment means the link cannot be sent and must
     not be shown, so there is nothing on its way and saying there is would be
     the fake this codebase does not ship. This says nothing about whether the
     address has an account: it is a fact about the deployment, true for every
     address typed into this form. */
  if (delivery === "unavailable") {
    return {
      ok: false,
      message: "We cannot send email from this deployment yet, so a reset link cannot be sent. Ask us to set it up.",
    };
  }

  /* Identical response whether or not the address exists. */
  return {
    ok: true,
    done: true,
    message: "If that address has an account, a reset link is on its way.",
  };
}

const resetSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: "Those two passwords do not match.",
    path: ["confirm"],
  });

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) return firstIssue(parsed.error);

  const result = await resetPassword({
    token: parsed.data.token,
    password: parsed.data.password,
  });

  if (!result.ok) {
    return {
      ok: false,
      message: result.message,
      field: result.error === "weak-password" ? "password" : null,
    };
  }

  /* Every other session was destroyed by the service. Start a fresh one so the
     student lands signed in rather than at a login form. */
  const agent = (await headers()).get("user-agent");
  await createSession(result.userId, agent);
  redirect("/home");
}

/* -------------------------------------------------------------------------- */
/* Verification                                                                */
/* -------------------------------------------------------------------------- */

export async function verifyEmailAction(token: string): Promise<{ ok: boolean; message: string }> {
  const result = await verifyEmail(token);
  return result.ok
    ? { ok: true, message: "Email confirmed." }
    : { ok: false, message: result.message };
}

export async function resendVerificationAction(): Promise<FormState> {
  const session = await readSession();
  if (!session) return { ok: false, message: "Sign in first." };

  const result = await resendVerification(session.user.id);
  if (!result) {
    return { ok: true, done: true, message: "Already confirmed, or try again in a few minutes." };
  }

  if (result.token && result.delivery === "shown") {
    redirect(`/verify-email?token=${encodeURIComponent(result.token)}`);
  }

  if (result.delivery === "unavailable") {
    return {
      ok: false,
      message: "We cannot send email from this deployment yet. Your account works; the address stays unconfirmed until we can.",
    };
  }

  return { ok: true, done: true, message: "New link sent." };
}
