import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { FormMessage } from "@/components/auth/form-kit";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const params = await props.searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  if (!token) {
    return (
      <div className="space-y-5">
        <h1 className="text-display-sm text-ink-950">That link is incomplete.</h1>
        <FormMessage tone="error">
          Reset links expire after an hour and can only be used once.
        </FormMessage>
        <Link
          href="/forgot-password"
          className="inline-block text-[0.875rem] font-medium text-ink-900 underline underline-offset-4"
        >
          Request a new one
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-display-sm text-ink-950">Choose a new password.</h1>
      <p className="mt-3 mb-8 text-[0.9375rem] leading-relaxed text-ink-600">
        This signs you out everywhere else, which is the point.
      </p>

      <ResetPasswordForm token={token} />
    </div>
  );
}
