import { BrandMark } from "@/components/brand/logo";

/**
 * Route-level loading. Deliberately a skeleton of the shape that is coming
 * rather than a spinner, so the page does not jump when it arrives.
 */
export default function Loading() {
  return (
    <div className="page py-16 sm:py-20" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      <div className="flex items-center gap-2 text-ink-300">
        <BrandMark className="size-5 animate-pulse" />
        <span className="font-mono text-micro uppercase tracking-[0.14em]">Loading</span>
      </div>

      <div className="mt-8 max-w-3xl space-y-4">
        <div className="h-10 w-3/4 animate-pulse rounded-lg bg-ink-100" />
        <div className="h-10 w-1/2 animate-pulse rounded-lg bg-ink-100" />
        <div className="h-4 w-2/3 animate-pulse rounded-full bg-ink-100" />
        <div className="h-4 w-1/2 animate-pulse rounded-full bg-ink-100" />
      </div>

      <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-40 animate-pulse rounded-lg border border-ink-200 bg-ink-50"
          />
        ))}
      </div>
    </div>
  );
}
