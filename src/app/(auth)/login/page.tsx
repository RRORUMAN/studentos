import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth/auth-forms";
import { FormMessage } from "@/components/auth/form-kit";
import { GoogleButton, googleReturnMessage } from "@/components/auth/google-button";
import { getAccount } from "@/server/viewer";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage(props: PageProps<"/login">) {
  const account = await getAccount();
  if (account) redirect(account.onboarded ? "/home" : "/onboarding");

  const params = await props.searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  /* Only same-origin paths survive. An absolute URL here would make the login
     form an open redirect. */
  const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : undefined;
  const google = Array.isArray(params.google) ? params.google[0] : params.google;
  const googleMessage = googleReturnMessage(google);

  return (
    <div>
      <h1 className="text-display-sm text-ink-950">Welcome back.</h1>
      <p className="mt-3 mb-8 text-[0.9375rem] leading-relaxed text-ink-600">
        Pick up where you left off.
      </p>

      {googleMessage ? (
        <div className="mb-5">
          <FormMessage tone={google === "cancelled" ? "ok" : "error"}>{googleMessage}</FormMessage>
        </div>
      ) : null}

      <div className="mb-5">
        <GoogleButton next={next} />
      </div>

      <SignInForm next={next} />
    </div>
  );
}
