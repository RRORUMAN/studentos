import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FormMessage } from "@/components/auth/form-kit";
import { MascotArt } from "@/components/mascot/mascot-art";
import { ButtonLink } from "@/components/ui/button";
import { verifyEmailAction } from "@/server/actions/auth";
import { getAccount } from "@/server/viewer";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
};

/**
 * Three states, decided on the server:
 *
 *   token present   consume it and report the outcome
 *   no token, signed in    explain what is waiting and offer a resend
 *   no token, signed out   send them to sign in
 *
 * Verification deliberately does not block the product. A student can finish
 * onboarding and use everything unverified; confirming the address is what
 * unlocks email notifications and the verified badge. Gating the whole app on
 * an email round-trip is the largest avoidable drop-off in any sign-up flow.
 */
export default async function VerifyEmailPage(props: PageProps<"/verify-email">) {
  const params = await props.searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const nextRaw = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = nextRaw?.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/home";

  const account = await getAccount();

  if (token) {
    const result = await verifyEmailAction(token);

    return (
      <div className="space-y-6 text-center">
        <MascotArt state={result.ok ? "celebrating" : "confused"} className="mx-auto size-24" />

        <h1 className="text-display-sm text-ink-950">
          {result.ok ? "Email confirmed." : "That link did not work."}
        </h1>

        <FormMessage tone={result.ok ? "ok" : "error"}>{result.message}</FormMessage>

        {result.ok ? (
          <ButtonLink href={next} variant="primary" size="lg" block>
            Continue
            <ArrowRight className="size-4" />
          </ButtonLink>
        ) : (
          <p className="text-[0.875rem] text-ink-500">
            Links last three days and work once.{" "}
            <Link href="/login" className="font-medium text-ink-900 underline underline-offset-4">
              Sign in
            </Link>{" "}
            and we will send another.
          </p>
        )}
      </div>
    );
  }

  if (!account) {
    return (
      <div className="space-y-6 text-center">
        <h1 className="text-display-sm text-ink-950">Check your email.</h1>
        <p className="text-[0.9375rem] leading-relaxed text-ink-600">
          Open the link we sent to confirm your address.
        </p>
        <ButtonLink href="/login" variant="outline" size="lg" block>
          Sign in
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center">
      <MascotArt state="thinking" className="mx-auto size-24" />
      <h1 className="text-display-sm text-ink-950">Confirm your email.</h1>
      <p className="text-[0.9375rem] leading-relaxed text-ink-600">
        We sent a link to <span className="font-medium text-ink-900">{account.user.email}</span>.
        You can keep using {""}
        <Link href="/home" className="font-medium text-ink-900 underline underline-offset-4">
          the app
        </Link>{" "}
        in the meantime — confirming just turns on email alerts and the verified badge.
      </p>
    </div>
  );
}
