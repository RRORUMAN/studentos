import type { CityHealth, DataHealthReport, DataSignal } from "@/server/queries/data-health";
import { coverageLevelLabel } from "@/server/queries/data-health";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * DATA HEALTH
 * ----------------------------------------------------------------------------
 * The operator's view of what is behind each city.
 *
 * Two blocks, deliberately apart. PROVIDERS is a question about this
 * deployment — are the seams connected — and is the same everywhere. CITIES is
 * a question about the world, and is different in every one. Merging them
 * produces the dashboard where Kraków is green because the code is fine.
 *
 * A city with nothing in it is not an error and is not coloured like one. It
 * is a city on its first day, and the note says the thing that would change
 * it.
 * ============================================================================
 */

const LEVEL_CLASS: Record<DataSignal["level"], string> = {
  strong: "bg-mint-soft text-mint-deep",
  working: "bg-signal-soft text-signal-deep",
  thin: "bg-amber-soft text-amber-deep",
  none: "bg-ink-100 text-ink-500",
};

export function DataHealth({ report }: { report: DataHealthReport }) {
  const byKind = {
    places: report.providers.filter((row) => row.kind === "places"),
    routing: report.providers.filter((row) => row.kind === "routing"),
    events: report.providers.filter((row) => row.kind === "events"),
    jobs: report.providers.filter((row) => row.kind === "jobs"),
  };

  return (
    <>
      {/* ---- providers ---------------------------------------------------- */}
      <section className="mt-9 border-t border-ink-200 pt-5">
        <h2 className="mb-1 text-[1.125rem] font-semibold tracking-[-0.012em] text-ink-950">
          Data providers
        </h2>
        <p className="mb-3.5 max-w-[70ch] text-[0.875rem] leading-relaxed text-ink-500">
          The seams between StudentOS and the world. An unconfigured one names the variable that
          would configure it, verbatim, because &ldquo;not configured&rdquo; without the variable is
          something to worry about rather than something to do.
        </p>

        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["places", "Places", byKind.places],
              ["routing", "Routing", byKind.routing],
              ["events", "Events", byKind.events],
              ["jobs", "Work", byKind.jobs],
            ] as const
          ).map(([key, label, rows]) => (
            <div key={key} className="rounded-lg border border-ink-200 bg-white p-4">
              <dt className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
                {label}
              </dt>
              <dd className="mt-2 space-y-2.5">
                {rows.map((row) => (
                  <div key={row.label}>
                    <p className="flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-900">
                      <span
                        aria-hidden
                        className={cn(
                          "inline-block size-1.5 shrink-0 rounded-full",
                          row.configured ? "bg-mint-deep" : "bg-ink-300",
                        )}
                      />
                      {row.label}
                      <span className="sr-only">{row.configured ? "configured" : "not configured"}</span>
                    </p>
                    <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-500">{row.detail}</p>
                  </div>
                ))}
                {rows.length === 0 ? (
                  <p className="text-[0.8125rem] text-ink-400">No provider of this kind.</p>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
          Place results are cached by area rather than stored, so there is no count of places in a
          city and none is shown. The cache currently holds{" "}
          <span className="tnum font-medium text-ink-700">{report.placeCacheEntries}</span>{" "}
          {report.placeCacheEntries === 1 ? "area" : "areas"} across{" "}
          <span className="tnum font-medium text-ink-700">{report.placeCacheCities}</span>{" "}
          {report.placeCacheCities === 1 ? "city" : "cities"}, which measures how much the product
          has been browsed and not what is out there.
        </p>
      </section>

      {/* ---- cities ------------------------------------------------------- */}
      <section className="mt-9 border-t border-ink-200 pt-5">
        <h2 className="mb-1 text-[1.125rem] font-semibold tracking-[-0.012em] text-ink-950">
          City coverage
        </h2>
        <p className="mb-3.5 max-w-[70ch] text-[0.875rem] leading-relaxed text-ink-500">
          Counted from rows at the moment this page loaded. Cities with a student in them, plus the
          five with full local content — the other{" "}
          <span className="tnum">{80 - report.cities.length}</span> have nobody in them yet and
          would only be a list of zeroes.{" "}
          <span className="text-ink-700">
            {report.institutionCount} institutions imported across {report.institutionCountries}{" "}
            {report.institutionCountries === 1 ? "country" : "countries"}.
          </span>
        </p>

        <ul className="space-y-2">
          {report.cities.map((city) => (
            <CityRow key={city.slug} city={city} />
          ))}
        </ul>

        {report.cities.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-300 p-6 text-center text-[0.875rem] text-ink-500">
            No city has a student in it yet.
          </p>
        ) : null}
      </section>
    </>
  );
}

function CityRow({ city }: { city: CityHealth }) {
  return (
    <li className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[0.9375rem] font-semibold text-ink-950">
          {city.name}
          <span className="ml-2 font-normal text-ink-400">{city.country}</span>
        </p>
        <p className="font-mono text-micro uppercase tracking-[0.08em] text-ink-400">
          {city.depth}
          {!city.located ? " · NO COORDINATE" : ""}
        </p>
      </div>

      {!city.located ? (
        <p className="mt-2 rounded border border-pulse-deep/25 bg-pulse-soft/60 p-2.5 text-[0.8125rem] text-ink-800">
          This city has no coordinate, so place search, distances and the map cannot work in it. Run{" "}
          <code className="font-mono">node scripts/import-cities.mjs</code>.
        </p>
      ) : null}

      <ul className="mt-2.5 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {city.signals.map((entry) => (
          <li key={entry.key} className="flex items-baseline gap-2">
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-mono text-micro font-semibold uppercase tracking-[0.06em]",
                LEVEL_CLASS[entry.level],
              )}
              title={entry.note}
            >
              {coverageLevelLabel[entry.level]}
            </span>
            <span className="min-w-0 text-[0.8125rem] text-ink-600">
              {entry.label}
              {entry.count !== null ? <span className="tnum text-ink-400"> · {entry.count}</span> : null}
            </span>
          </li>
        ))}
      </ul>

      {/* The weakest signal, named. An operator opening this screen wants the
          one thing to go and fix, not six bands to compare. */}
      {(() => {
        const weakest = [...city.signals].sort(
          (a, b) =>
            ["none", "thin", "working", "strong"].indexOf(a.level) -
            ["none", "thin", "working", "strong"].indexOf(b.level),
        )[0];
        return weakest && weakest.level !== "strong" ? (
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-500">
            <span className="font-medium text-ink-700">{weakest.label}:</span> {weakest.note}
          </p>
        ) : null;
      })()}
    </li>
  );
}
