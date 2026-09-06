import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { MascotArt } from "@/components/mascot/mascot-art";
import { ButtonLink } from "@/components/ui/button";

/**
 * In-app not found. Deliberately the same for "never existed" and "exists but
 * is not yours" — a private plan, a group you are not in, another student's
 * chat — because confirming that something private exists is itself a leak.
 */
export default function AppNotFound() {
  return (
    <div className="page flex min-h-[60vh] max-w-lg flex-col items-center justify-center py-16 text-center">
      <MascotArt state="empty" className="size-20" />
      <p className="mt-6 font-mono text-micro uppercase tracking-[0.14em] text-ink-400">Not found</p>
      <h1 className="mt-3 text-display-xs text-ink-950">That could not be found.</h1>
      <p className="mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-ink-600">
        It may have been removed, the link may be wrong, or it belongs to someone else. Nothing here is broken on your side.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/home" variant="primary" size="md">
          <ArrowLeft className="size-4" />
          Back to Home
        </ButtonLink>
        <Link href="/discover" className="inline-flex h-10 items-center rounded-full px-4 text-[0.9375rem] font-medium text-ink-700 ring-1 ring-ink-950/8 hover:ring-ink-950/20">
          Discover
        </Link>
      </div>
    </div>
  );
}
