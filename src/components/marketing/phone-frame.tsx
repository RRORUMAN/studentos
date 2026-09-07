import type { ReactNode } from "react";

import { SampleTag } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * A phone, drawn rather than photographed. Two nested rounded rectangles and a
 * status row: enough to say "this is the app on a phone" without shipping a
 * device mockup image, and it scales down to 320px instead of overflowing.
 *
 * The screen is light because the product's Home is light. The dark consoles
 * elsewhere on the page are the Ask surface, and keeping the two distinct is
 * what stops every screenshot on the site looking the same.
 */
export function PhoneFrame({
  time = "16:04",
  children,
  sample = true,
  className,
}: {
  time?: string;
  children: ReactNode;
  sample?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-[19.5rem] rounded-[2.25rem] bg-ink-950 p-2.5 shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      <div className="overflow-hidden rounded-[1.75rem] bg-paper">
        {/* status row */}
        <div className="flex items-center justify-between px-5 pt-3 pb-1">
          <span className="tnum font-mono text-[0.6875rem] font-medium text-ink-900">{time}</span>
          <span aria-hidden className="h-4 w-16 rounded-full bg-ink-950" />
          <span aria-hidden className="flex items-center gap-1">
            <span className="h-2 w-3 rounded-xs bg-ink-300" />
            <span className="h-2.5 w-4.5 rounded-xs bg-ink-900" />
          </span>
        </div>

        <div className="px-4 pt-2 pb-5">{children}</div>
      </div>

      {sample ? (
        <SampleTag className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white shadow-[var(--shadow-raise)]" />
      ) : null}
    </div>
  );
}
