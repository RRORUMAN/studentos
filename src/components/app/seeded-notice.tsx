import { Info } from "lucide-react";

/**
 * The standing notice shown whenever the product is answering from seeded
 * sample content rather than a live database.
 *
 * This is not a nicety and it is not dismissible. Events, deals and community
 * posts in a demo install are plausible, specific and made up; presenting them
 * with the same confidence as live listings would be the single most damaging
 * thing this product could do to its own credibility. A student who acts on a
 * fake "free entry tonight" and finds a locked door does not come back.
 *
 * It disappears the moment `NEXT_PUBLIC_SUPABASE_URL` is configured — see
 * `isSeededData` in `src/server/db/index.ts`.
 */
export function SeededDataNotice() {
  return (
    <div className="border-b border-amber-deep/15 bg-amber-soft/70">
      <p className="page flex items-start gap-2.5 py-2.5 text-[0.8125rem] leading-snug text-amber-deep">
        <Info className="mt-px size-4 shrink-0" />
        <span>
          <span className="font-semibold">Sample city data.</span> Events, deals and posts here are
          seeded examples for evaluating the product, not live listings. Official information links
          to real sources.
        </span>
      </p>
    </div>
  );
}
