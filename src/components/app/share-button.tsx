"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Share a link. Uses the native share sheet where the browser has one and the
 * clipboard everywhere else. The URL is built from the current origin so a
 * preview deployment never hands out a production link.
 */
export function ShareButton({
  path,
  title,
  label = "Share",
  className,
  size = "md",
}: {
  path: string;
  title: string;
  label?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}${path}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* Cancelled share sheet or blocked clipboard: nothing to report. */
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white font-medium text-ink-700 transition-colors hover:border-ink-300",
        size === "sm" ? "px-3 py-1.5 text-[0.8125rem]" : "px-3.5 py-2 text-[0.875rem]",
        className,
      )}
    >
      {copied ? <Check className="size-4 text-mint-deep" /> : <Share2 className="size-4" />}
      {copied ? "Link copied" : label}
    </button>
  );
}
