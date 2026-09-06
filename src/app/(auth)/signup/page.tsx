import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignUpForm } from "@/components/auth/auth-forms";
import { GoogleButton } from "@/components/auth/google-button";
import { brand } from "@/brand/brand.config";
import { getAccount } from "@/server/viewer";

export const metadata: Metadata = {
  title: "Create your account",
  description: `Set up ${brand.name} for your city. Free, no card.`,
  robots: { index: false, follow: false },
};

export default async function SignUpPage(props: PageProps<"/signup">) {
  /* Already signed in: send them where they were going rather than showing a
     sign-up form to someone who has an account. */
  const account = await getAccount();
  if (account) redirect(account.onboarded ? "/home" : "/onboarding");

  const params = await props.searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : undefined;

  return (
    <div>
      <h1 className="text-display-sm text-ink-950">Make the city cheaper.</h1>
      <p className="mt-3 mb-8 text-[0.9375rem] leading-relaxed text-ink-600">
        Two minutes of setup and {brand.name} knows your city, your budget and what you are into.
      </p>

      <div className="mb-5">
        <GoogleButton next={next} />
      </div>

      <SignUpForm />
    </div>
  );
}
