"use client";

import { RefreshCw } from "lucide-react";
import { useEffect } from "react";

import { BrandMark } from "@/components/brand/logo";
import { Button, ButtonLink } from "@/components/ui/button";
import { brand } from "@/brand/brand.config";
import { captureError } from "@/services/monitoring";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error, { boundary: "app", digest: error.digest });
  }, [error]);

  return (
    <div className="page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <BrandMark className="size-8 text-ink-950" />
      <p className="mt-6 font-mono text-micro uppercase tracking-[0.14em] text-ink-400">
        Something broke
      </p>
      <h1 className="mt-4 max-w-xl text-display-md text-ink-950">
        That did not load, and it is our fault rather than yours.
      </h1>
      <p className="mt-4 max-w-md text-base leading-relaxed text-ink-600">
        The error has been reported. Trying again usually works — if it does not, everything else on{" "}
        {brand.name} is still fine.
      </p>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button variant="primary" size="lg" onClick={reset}>
          <RefreshCw className="size-4.5" aria-hidden />
          Try again
        </Button>
        <ButtonLink href="/" variant="outline" size="lg">
          Go to the start
        </ButtonLink>
      </div>

      {error.digest ? (
        <p className="mt-6 font-mono text-micro text-ink-300">Reference {error.digest}</p>
      ) : null}
    </div>
  );
}
