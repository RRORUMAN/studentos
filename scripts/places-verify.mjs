#!/usr/bin/env node
/**
 * ============================================================================
 * PLACE PROVIDER VERIFICATION
 * ----------------------------------------------------------------------------
 * Proves the place layer returns real places, by asking it for some — through
 * the product's own service, not a hand-written fetch.
 *
 *   pnpm places:verify
 *   pnpm places:verify madrid berlin
 *
 * It exists for the same reason `ai:verify` does. `searchPlaces` is built to
 * degrade: a provider outage falls through to the next provider, then to a
 * dated cache entry, then to an honest "couldn't reach the map". That is right
 * for a student standing in the street and useless for a deploy, because every
 * one of those states looks calm. This script makes the degradation visible.
 *
 * WHAT IT CHECKS, in order:
 *
 *   1. Every city has a coordinate. A city with none has no place search at
 *      all, and the failure is silent at runtime.
 *   2. A real search returns named places with coordinates inside the radius.
 *   3. Provenance is present on every row — provider, source URL, attribution.
 *      A place that cannot be traced is one the interface must not show.
 *   4. Nothing was invented: no row carries a rating from a provider that does
 *      not publish ratings.
 *   5. Routing says honestly whether it can produce a duration.
 *
 * Exits non-zero on failure, so it can gate a deploy.
 * ============================================================================
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

const symbols = { pass: "  ok ", fail: "FAIL ", warn: "warn ", info: "     " };
let failures = 0;

const pass = (message) => console.log(`${symbols.pass}${message}`);
const info = (message) => console.log(`${symbols.info}${message}`);
const warn = (message) => console.log(`${symbols.warn}${message}`);

function fail(message, detail) {
  failures += 1;
  console.log(`${symbols.fail}${message}`);
  if (detail) for (const line of String(detail).split("\n")) console.log(`${symbols.info}${line}`);
}

async function loadEnvFiles() {
  for (const name of [".env.local", ".env"]) {
    let raw;
    try {
      raw = await readFile(join(process.cwd(), name), "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
    }
    info(`read ${name}`);
  }
}

async function main() {
  console.log("");
  console.log("StudentOS — place provider verification");
  console.log("─".repeat(72));

  await loadEnvFiles();

  const { allCoverageCities, coverageStats } = await import("@/config/regions");
  const { distanceMetres } = await import("@/domain/places");
  const { searchPlaces, placeProviders } = await import("@/server/places");
  const { routeProviders, routingConfigured } = await import("@/server/places/route");

  /* ---- 1. geography ----------------------------------------------------- */

  const noGeo = allCoverageCities.filter(
    (city) => !Number.isFinite(city.lat) || !Number.isFinite(city.lng),
  );
  if (noGeo.length) {
    fail(`${noGeo.length} cities have no coordinate`, noGeo.map((c) => c.key).join(", "));
  } else {
    pass(
      `${coverageStats.cities} cities across ${coverageStats.countries} countries, all with coordinates (imported ${coverageStats.geographyFetchedOn})`,
    );
  }

  /* ---- 2. providers ----------------------------------------------------- */

  for (const provider of placeProviders()) {
    const status = provider.status();
    if (status.configured) pass(`${provider.label}: ${status.detail}`);
    else info(`${provider.label}: ${status.missing}`);
  }

  const anyConfigured = placeProviders().some((provider) => provider.status().configured);
  if (!anyConfigured) {
    fail(
      "no place provider is configured",
      "OpenStreetMap needs nothing, so this should be impossible. Check OVERPASS_URL.",
    );
    return finish();
  }

  for (const provider of routeProviders()) {
    const status = provider.status();
    if (status.configured) pass(`${provider.label}: ${status.detail}`);
    else info(`${provider.label}: ${status.missing}`);
  }
  if (!routingConfigured()) {
    warn("no routing provider — the product will show distances, not walking times");
  }

  /* ---- 3. real searches ------------------------------------------------- */

  const wanted = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  const cities = (wanted.length ? wanted : ["madrid", "berlin"])
    .map((key) => allCoverageCities.find((city) => city.key === key))
    .filter(Boolean);

  if (!cities.length) {
    fail("none of the named cities exist", wanted.join(", "));
    return finish();
  }

  console.log("");

  const succeeded = [];

  for (const city of cities) {
    const radius = 1_500;
    const started = Date.now();
    const outcome = await searchPlaces({
      centre: { lat: city.lat, lng: city.lng },
      radiusMetres: radius,
      categories: ["supermarket", "pharmacy"],
      limit: 12,
    });
    const took = Date.now() - started;

    if (!outcome.ok) {
      fail(
        `${city.name}: ${outcome.reason} — ${outcome.message}`,
        outcome.attempts.map((a) => `${a.provider}: ${a.error}`).join("\n"),
      );
      continue;
    }

    if (outcome.places.length === 0) {
      fail(
        `${city.name}: the provider answered with no places`,
        "A supermarket and a pharmacy within 1.5 km of a city centre is not a\n" +
          "plausible empty result. Check the category mapping.",
      );
      continue;
    }

    succeeded.push(city);
    pass(
      `${city.name}: ${outcome.places.length} places from ${outcome.provider} in ${took} ms${outcome.stale ? " (STALE CACHE)" : ""}`,
    );

    /* Provenance, on every row. */
    const unsourced = outcome.places.filter(
      ({ place }) => !place.sourceUrl || !place.attribution || !place.providerPlaceId,
    );
    if (unsourced.length) {
      fail(`${city.name}: ${unsourced.length} places have no provenance`);
    }

    /* Geography: every result inside the radius it was asked for, with a bit
       of slack for a provider that rounds its own bounding box. */
    const outside = outcome.places.filter(
      ({ place }) => distanceMetres({ lat: city.lat, lng: city.lng }, place) > radius * 1.35,
    );
    if (outside.length) {
      fail(
        `${city.name}: ${outside.length} places are outside the search radius`,
        outside
          .slice(0, 3)
          .map(
            ({ place }) =>
              `${place.name} at ${Math.round(distanceMetres({ lat: city.lat, lng: city.lng }, place))} m`,
          )
          .join("\n"),
      );
    }

    /* Nothing invented: OpenStreetMap publishes no ratings, so a row from it
       carrying one means something in the adapter made a number up. */
    const invented = outcome.places.filter(
      ({ place }) => place.provider === "osm" && (place.rating !== null || place.priceLevel !== null),
    );
    if (invented.length) {
      fail(`${city.name}: ${invented.length} OpenStreetMap rows carry a rating or a price level`);
    }

    for (const { place, proximity, value } of outcome.places.slice(0, 3)) {
      info(
        `${place.name} — ${place.category}, ${proximity.metres} m ${proximity.minutes === null ? "(straight line)" : `/ ${proximity.minutes} min routed`}, value: ${value.band}`,
      );
    }
    info(`attribution: ${outcome.attribution}`);
    console.log("");
  }

  /* ---- 4. the cache ----------------------------------------------------- */

  /* Against a city that answered: re-running a search that failed proves
     nothing about caching, because a failure is deliberately not cached. */
  const first = succeeded[0] ?? cities[0];
  const started = Date.now();
  const again = await searchPlaces({
    centre: { lat: first.lat, lng: first.lng },
    radiusMetres: 1_500,
    categories: ["supermarket", "pharmacy"],
    limit: 12,
  });
  const cachedMs = Date.now() - started;
  if (again.ok && cachedMs < 250) pass(`cache hit: the same search answered in ${cachedMs} ms`);
  else if (again.ok) warn(`second search took ${cachedMs} ms — the cache may not be storing`);

  return finish();
}

function finish() {
  console.log("─".repeat(72));
  if (failures === 0) {
    console.log("Place providers verified.\n");
    process.exit(0);
  }
  console.log(`${failures} check${failures === 1 ? "" : "s"} failed.\n`);
  process.exit(1);
}

await main();
