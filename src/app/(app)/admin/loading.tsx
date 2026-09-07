/**
 * ============================================================================
 * ADMIN — LOADING
 * ----------------------------------------------------------------------------
 * The shape of the console, before the console arrives.
 *
 * The route-level skeleton in `src/app/loading.tsx` draws a generic column of
 * cards, which is right for most screens and wrong for this one: admin opens
 * with a full-width dark panel, so the page visibly jumped from a pale card
 * grid to a black block every time it loaded. A skeleton that does not match
 * what follows is worse than no skeleton — it promises one layout and delivers
 * another.
 *
 * This one is worth having rather than streaming straight to content because
 * the page does several full table passes before it can render a number.
 * ============================================================================
 */
export default function AdminLoading() {
  return (
    <div className="page py-6 sm:py-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the console</span>

      <header className="mb-5">
        <p className="font-mono text-micro uppercase tracking-[0.14em] text-ink-300">Founder console</p>
        <div className="mt-2 h-8 w-32 animate-pulse rounded-lg bg-ink-100 motion-reduce:animate-none" />
      </header>

      {/* The dark panel is drawn for real, not as a grey box: it is the thing
          that would otherwise cause the jump. */}
      <section className="overflow-hidden rounded-2xl bg-linear-to-b from-console-2 to-console shadow-[var(--shadow-console)] ring-1 ring-white/8">
        <div className="grid gap-7 p-5 sm:p-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] lg:gap-12">
          <div className="space-y-3">
            <p className="font-mono text-micro uppercase tracking-[0.14em] text-signal/40">North star</p>
            <div className="h-12 w-28 animate-pulse rounded-lg bg-white/10 motion-reduce:animate-none" />
            <div className="h-3.5 w-full max-w-[30ch] animate-pulse rounded-full bg-white/8 motion-reduce:animate-none" />
            <div className="h-3.5 w-2/3 max-w-[22ch] animate-pulse rounded-full bg-white/8 motion-reduce:animate-none" />
          </div>

          <div className="flex flex-col justify-end gap-4">
            <div className="h-14 w-full animate-pulse rounded-lg bg-white/6 motion-reduce:animate-none" />
            <div className="h-14 w-full animate-pulse rounded-lg bg-white/6 motion-reduce:animate-none" />
          </div>
        </div>

        <div className="border-t border-white/10 bg-black/20 px-5 py-3.5 sm:px-6">
          <div className="h-3 w-56 animate-pulse rounded-full bg-white/10 motion-reduce:animate-none" />
        </div>
      </section>

      <div className="mt-9 border-t border-ink-200 pt-5">
        <div className="h-5 w-24 animate-pulse rounded-md bg-ink-100 motion-reduce:animate-none" />
      </div>

      <div className="mt-3.5 grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-xl border border-ink-200 bg-white motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}
