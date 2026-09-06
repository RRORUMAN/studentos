import Link from "next/link";

import { Wordmark } from "@/components/brand/logo";
import { MascotArt } from "@/components/mascot/mascot-art";
import { brand } from "@/brand/brand.config";

/**
 * ============================================================================
 * AUTH LAYOUT
 * ----------------------------------------------------------------------------
 * A single centred column. No site nav, no footer, no pricing link.
 *
 * That absence is the design: every link on an auth screen is a chance to
 * leave it. The only navigation out is the wordmark, which goes home, and
 * whatever the form itself offers.
 * ============================================================================
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main id="main" className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 text-ink-300/50 dotfield [mask-image:radial-gradient(60%_45%_at_50%_0%,black,transparent)]"
      />

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12 sm:py-16">
        <Link href="/" className="mx-auto mb-8 inline-flex" aria-label={`${brand.name} home`}>
          <Wordmark />
        </Link>

        {children}

        <p className="mt-10 flex items-center justify-center gap-2 text-center text-[0.8125rem] text-ink-400">
          <MascotArt state="neutral" className="size-6" />
          <span>Free tier is not a trial. No card to start.</span>
        </p>
      </div>
    </main>
  );
}
