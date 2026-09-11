import { allCoverageCities, coverageStats } from "@/config/regions";

/**
 * ============================================================================
 * COVERAGE TICKER
 * ----------------------------------------------------------------------------
 * Where a SaaS page puts a row of customer logos, this one puts the cities it
 * works in — because StudentOS has no customer logos to show, and inventing a
 * row of universities that "trust" it would be the first lie on the page.
 *
 * Every name is a real row from `config/regions.ts`, largest first by the
 * municipality population Wikidata states. A mint dot marks the cities with a
 * full local record. The strip is decorative for assistive tech — the sentence
 * before it says the same thing in words — so the moving list is hidden from
 * screen readers rather than read out twice.
 * ============================================================================
 */

const SHOWN = 36;

const tickerCities = [...allCoverageCities]
  .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
  .slice(0, SHOWN);

export function CoverageTicker() {
  return (
    <section
      aria-label="Where StudentOS works"
      className="relative overflow-hidden border-y border-ink-200/70 bg-white/70 py-4"
    >
      <div className="page flex flex-col gap-3 md:flex-row md:items-center md:gap-8">
        <p className="shrink-0 font-mono text-micro tracking-[0.14em] text-ink-500 uppercase">
          Works from day one in{" "}
          <span className="tnum font-semibold text-ink-950">{coverageStats.cities}</span> cities
        </p>

        <div aria-hidden className="relative min-w-0 flex-1 overflow-hidden edge-fade-x">
          <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
            {[0, 1].map((copy) => (
              <ul key={copy} className="flex shrink-0 items-center gap-7 pr-7">
                {tickerCities.map((city) => (
                  <li
                    key={city.key}
                    className="flex items-center gap-1.5 text-[0.9375rem] font-medium whitespace-nowrap text-ink-700"
                  >
                    {city.depth === "deep" ? (
                      <span className="size-1.5 rounded-full bg-mint" />
                    ) : null}
                    {city.name}
                    <span className="font-mono text-[0.625rem] text-ink-400">{city.countryCode}</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
