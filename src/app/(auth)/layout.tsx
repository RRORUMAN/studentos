import { BadgeCheck, Globe2, HeartHandshake } from "lucide-react";
import Link from "next/link";

import { Wordmark } from "@/components/brand/logo";
import { MascotArt } from "@/components/mascot/mascot-art";
import { SampleTag } from "@/components/ui/primitives";
import { brand } from "@/brand/brand.config";
import { coverageStats } from "@/config/regions";
import { todayBrief } from "@/data/brain";
import { safeThisWeek, safeToday } from "@/data/budget";
import { getCity } from "@/data/cities";
import { money } from "@/lib/utils";

/**
 * ============================================================================
 * AUTH LAYOUT
 * ----------------------------------------------------------------------------
 * The form on the left, the product on the right.
 *
 * Still no site nav, no footer, no pricing link: every link on an auth screen
 * is a chance to leave it, so the only way out is the wordmark. What changed
 * is the other half of a wide screen, which used to be an empty dotted field.
 * It now shows what the account is FOR — the Today screen a student lands on,
 * two numbers and a brief — drawn from the same seeded rows as the landing
 * page and labelled as a sample in the same way.
 *
 * The three facts under it are derived or already promised elsewhere:
 * coverage comes from `config/regions.ts`, the free tier is the pricing page's
 * own commitment, and "every sample says sample" is the rule the panel itself
 * is keeping.
 *
 * Below `lg` the panel is not rendered at all. On a phone the form is the
 * whole screen, which is what a phone sign-up should be.
 * ============================================================================
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  const city = getCity(todayBrief.citySlug);

  return (
    <main
      id="main"
      className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,38rem)]"
    >
      {/* ---- the form ------------------------------------------------------ */}
      <div className="relative flex min-w-0 flex-col px-5 py-6 sm:px-10 sm:py-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 text-ink-300/40 dotfield [mask-image:radial-gradient(70%_40%_at_30%_0%,black,transparent)]"
        />

        <Link href="/" className="relative inline-flex self-start" aria-label={`${brand.name} home`}>
          <Wordmark />
        </Link>

        <div className="relative mx-auto flex w-full max-w-[25rem] flex-1 flex-col justify-center py-12">
          {children}
        </div>

        <p className="relative flex items-center justify-center gap-2 text-center text-[0.8125rem] text-ink-500 lg:justify-start">
          <MascotArt state="neutral" className="size-6" />
          <span>The free tier is not a trial. No card to start.</span>
        </p>
      </div>

      {/* ---- the product --------------------------------------------------- */}
      <aside
        aria-label={`What ${brand.name} looks like`}
        data-surface="dark"
        className="relative hidden overflow-hidden bg-console text-white lg:flex lg:flex-col lg:justify-center lg:px-12 xl:px-16"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="mesh-blob top-[-10rem] right-[-8rem] size-[30rem] bg-signal/14" />
          <div className="absolute inset-0 text-white/[0.04] gridline [mask-image:radial-gradient(80%_60%_at_70%_0%,black,transparent_75%)]" />
        </div>

        <div className="relative">
          <MascotArt state="happy" idle className="size-16" />
          <p className="mt-6 max-w-sm font-display text-[2rem] leading-[1.05] font-semibold tracking-[-0.03em]">
            Your new city, <span className="text-signal">figured out</span>.
          </p>

          {/* the screen the account opens on */}
          <div className="mt-8 rounded-2xl bg-white/[0.05] p-5 ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-micro tracking-[0.12em] text-white/45 uppercase">
                {todayBrief.greeting} · {city?.name ?? "your city"}
              </p>
              <SampleTag onDark />
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <dt className="font-mono text-[0.625rem] tracking-[0.1em] text-white/45 uppercase">
                  Safe today
                </dt>
                <dd className="tnum mt-1 font-mono text-[1.75rem] leading-none font-semibold text-mint">
                  {money(safeToday())}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[0.625rem] tracking-[0.1em] text-white/45 uppercase">
                  This week
                </dt>
                <dd className="tnum mt-1 font-mono text-[1.75rem] leading-none font-semibold text-white">
                  {money(safeThisWeek())}
                </dd>
              </div>
            </dl>

            <ul className="mt-5 flex flex-col border-t border-white/8 pt-2">
              {todayBrief.lines.slice(0, 3).map((line) => (
                <li
                  key={line.text}
                  className="flex items-center gap-2.5 border-b border-white/6 py-2 text-[0.875rem] text-white/80 last:border-b-0"
                >
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-signal" />
                  {line.text}
                </li>
              ))}
            </ul>
          </div>

          <ul className="mt-8 flex flex-col gap-3 text-[0.875rem] text-white/70">
            <li className="flex items-center gap-2.5">
              <HeartHandshake className="size-4 shrink-0 text-white/45" aria-hidden />
              Community, events and a real budget, free for good
            </li>
            <li className="flex items-center gap-2.5">
              <Globe2 className="size-4 shrink-0 text-white/45" aria-hidden />
              <span className="tnum">
                {coverageStats.cities} cities, {coverageStats.countries} countries,{" "}
                {coverageStats.currencies} currencies
              </span>
            </li>
            <li className="flex items-center gap-2.5">
              <BadgeCheck className="size-4 shrink-0 text-white/45" aria-hidden />
              Nothing invented. Every sample says sample.
            </li>
          </ul>
        </div>
      </aside>
    </main>
  );
}
