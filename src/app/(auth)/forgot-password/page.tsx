import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-display-sm text-ink-950">Reset your password.</h1>
      <p className="mt-3 mb-8 text-[0.9375rem] leading-relaxed text-ink-600">
        Enter the address you signed up with and we will send a link.
      </p>

      <ForgotPasswordForm />
    </div>
  );
}
