"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, FormMessage, PasswordField, SubmitButton } from "@/components/auth/form-kit";
import {
  requestResetAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
} from "@/server/actions/auth";
import { emptyFormState, type FormState } from "@/server/actions/form-state";
import { PASSWORD_MIN_LENGTH } from "@/config/auth";

/**
 * ============================================================================
 * AUTH FORMS
 * ----------------------------------------------------------------------------
 * Four forms, each a thin client wrapper around a Server Action via
 * `useActionState`. The pages that host them stay server components, so none of
 * the copy or metadata ships to the browser.
 *
 * Every one degrades to a plain form post with JavaScript disabled.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Sign up                                                                     */
/* -------------------------------------------------------------------------- */

export function SignUpForm() {
  const [state, action] = useActionState<FormState, FormData>(signUpAction, emptyFormState);

  return (
    <form action={action} className="space-y-4">
      {state.message ? <FormMessage tone="error">{state.message}</FormMessage> : null}

      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@university.edu"
        invalid={state.field === "email"}
        hint="A university address gets you the verified badge automatically."
      />

      <PasswordField
        autoComplete="new-password"
        showStrength
        invalid={state.field === "password"}
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. Three random words works well.`}
      />

      <PasswordField
        label="Confirm password"
        name="confirm"
        autoComplete="new-password"
        invalid={state.field === "confirm"}
      />

      <SubmitButton>Create account</SubmitButton>

      <p className="text-center text-[0.8125rem] text-ink-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink-900 underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Sign in                                                                     */
/* -------------------------------------------------------------------------- */

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState<FormState, FormData>(signInAction, emptyFormState);

  return (
    <form action={action} className="space-y-4">
      {state.message ? <FormMessage tone="error">{state.message}</FormMessage> : null}

      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        invalid={state.field === "email"}
      />

      <div className="space-y-1.5">
        <PasswordField autoComplete="current-password" invalid={state.field === "password"} />
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-[0.8125rem] text-ink-500 underline underline-offset-4 hover:text-ink-900"
          >
            Forgot password?
          </Link>
        </div>
      </div>

      <SubmitButton>Sign in</SubmitButton>

      <p className="text-center text-[0.8125rem] text-ink-500">
        New here?{" "}
        <Link href="/signup" className="font-medium text-ink-900 underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Forgot password                                                             */
/* -------------------------------------------------------------------------- */

export function ForgotPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(requestResetAction, emptyFormState);

  /* The success panel deliberately does not confirm whether the address
     exists — see the enumeration note in `server/auth/service.ts`. */
  if (state.done) {
    return (
      <div className="space-y-4">
        <FormMessage tone="ok">{state.message}</FormMessage>
        <p className="text-[0.875rem] leading-relaxed text-ink-500">
          The link is good for an hour. Check spam before asking for another one.
        </p>
        <Link
          href="/login"
          className="inline-block text-[0.875rem] font-medium text-ink-900 underline underline-offset-4"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.message && !state.ok ? <FormMessage tone="error">{state.message}</FormMessage> : null}

      <Field label="Email" name="email" type="email" autoComplete="email" invalid={state.field === "email"} />

      <SubmitButton>Send reset link</SubmitButton>

      <p className="text-center text-[0.8125rem] text-ink-500">
        <Link href="/login" className="font-medium text-ink-900 underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Reset password                                                              */
/* -------------------------------------------------------------------------- */

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState<FormState, FormData>(resetPasswordAction, emptyFormState);

  return (
    <form action={action} className="space-y-4">
      {state.message ? <FormMessage tone="error">{state.message}</FormMessage> : null}

      <input type="hidden" name="token" value={token} />

      <PasswordField
        label="New password"
        autoComplete="new-password"
        showStrength
        invalid={state.field === "password"}
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
      />

      <PasswordField
        label="Confirm new password"
        name="confirm"
        autoComplete="new-password"
        invalid={state.field === "confirm"}
      />

      <SubmitButton>Set new password</SubmitButton>

      <p className="text-center text-[0.8125rem] text-ink-500">
        Signing in everywhere else will be required again after this.
      </p>
    </form>
  );
}
