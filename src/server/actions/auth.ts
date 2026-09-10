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
 * On the verification link: with no Resend key configured, `signUp` returns the
 * token and this layer redirects straight to it. That is a *development*
 * affordance. It is gated on BOTH the mailer being unconfigured AND this not
 * being a production deployment (`VERCEL_ENV === "production"`) — a missing
 * Resend key in production must dead-end with the generic message, never hand
 * the browser a live token in a URL. The env gate exists because a token in a
 * redirect is exactly the sort of thing that quietly survives to production.
 * ============================================================================
 */

/* Production must never surface auth tokens in a redirect, whatever the mailer
   state. Vercel sets VERCEL_ENV to "production" only on production deploys. */
const isLiveDeploy = process.env.VERCEL_ENV === "production";

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

  const { token } = await requestPasswordReset(email);

  /* Development affordance, gated on the mailer being unconfigured — see the
     module header. */
  if (token && !process.env.RESEND_API_KEY && !isLiveDeploy) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}`);
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

  const token = await resendVerification(session.user.id);
  if (!token) {
    return { ok: true, done: true, message: "Already confirmed, or try again in a few minutes." };
  }

  if (!process.env.RESEND_API_KEY && !isLiveDeploy) {
    redirect(`/verify-email?token=${encodeURIComponent(token)}`);
  }

  return { ok: true, done: true, message: "New link sent." };
}
