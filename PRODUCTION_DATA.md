# Where StudentOS's data comes from

Every real-world claim the product makes, and what is behind it.

This exists because the interesting question about a product like this is not
"does it work" but "how does it know". A screen showing a supermarket, a price
and a walking time looks the same whether those came from a provider, from a
student, or from somebody typing plausible things into a file. This document
says which, per source, and says plainly where the answer is "nothing yet".

Read it alongside `PRODUCTION_SETUP.md`, which is the same list from the other
direction: what you have to go and configure.

---

## The rule everything below follows

**A real-world claim is either sourced or it is absent.** Not "sourced or
estimated" — an estimate is allowed, but only where it names its basis in the
interface, next to the number. There is no third state where something plausible
fills a gap.

Concretely, three things that are true of every screen:

- A **price** is what a source published or what students reported paying. No
  provider publishes an amount for a place, so places show a price *band* and
  the words "Price not listed" when even that is missing.
- A **duration** comes from a routing provider. A distance measured between two
  points is shown as a distance — "600 m away" — and never as "8 min walk".
- A **count of other students** is counted from rows. Zero renders nothing, not
  a zero, and never a placeholder.

---

## Cities

| | |
| --- | --- |
| **Source** | [Wikidata](https://www.wikidata.org), SPARQL endpoint |
| **What it gives** | Coordinates (P625), population (P1082), the entity id |
| **Import** | `node scripts/import-cities.mjs` → `src/data/cities/geo.generated.ts` |
| **Refresh** | Manual. City centres do not move. |
| **Coverage** | 80 cities, 47 countries |
| **Configuration** | None |

Currency, formatting locale, timezone and the languages a student will meet are
editorial and live in `src/config/regions.ts`, one row per **country** rather
than per city, so "Spain uses the euro" is stated once and cannot disagree with
itself.

`regions.ts` **throws at module load** if a city has no coordinate. Adding a
city without re-running the import fails the build rather than shipping a city
whose map opens in the Atlantic.

Three things the importer gets right, each found by getting it wrong first, and
all three documented in the script itself:

- Searching Wikidata for "Madrid" returns the city, the province and the
  autonomous community. Preferring the largest population picks the community.
- Asking "is it a city" (`P31/P279* → Q515`) rejects Madrid, Valencia, Bilbao,
  Granada, Bologna, Seville and Manchester, which Wikidata classes as
  municipalities. Excluding administrative divisions instead rejects Berlin,
  Hamburg and Vienna, which are city-states. The union of city, human settlement
  and municipality accepts all of them and no parent.
- Bangkok has five `P17 country` statements — Thailand plus four historical
  kingdoms. Keeping the first meant the city was sometimes recorded as being in
  the Ayutthaya Kingdom, and failed its own country check.

---

## Institutions

| | |
| --- | --- |
| **Source** | Wikidata, plus a curated overlay |
| **What it gives** | Official name, alternative spellings, website, coordinates, the QID |
| **Import** | `node scripts/import-institutions.mjs ES` → `src/data/institutions/es.generated.ts` |
| **Refresh** | Manual, per country |
| **Coverage** | **Spain only.** 190 imported rows, merged with 38 curated. |
| **Configuration** | None |

**Why not the official registry.** RUCT — the Registro de Universidades, Centros
y Títulos — is the authority for Spain and was the first thing tried. It is a
JSP form over iso-8859-15 HTML with no export, no API and no bulk file. Turning
it into a dataset means scraping a government form, which breaks silently the
first time a hidden field is renamed and then serves a stale registry to
students. Wikidata is machine-readable, has a stable id per institution, and is
maintained by people other than us.

**The curated overlay** is the only source allowed to claim a campus location. A
curated row wins every field it declares and takes the rest from the imported
row it matched, so Universitat Politècnica de Catalunya keeps the Catalan name
its students use and gains the website, the coordinates and the eight spellings
that make it findable. Matching is by exact folded name or alias, never fuzzy: a
wrong merge is silent and permanent.

**A student can always continue.** Onboarding never blocks on the registry being
incomplete — "Can't find your institution?" writes an `institutionSubmission`
row with `status: "pending_review"`, and `/admin` has the queue.

**What is missing:** every country except Spain. Institutions outside it are
searchable only if somebody submitted them. Adding a country is one command.

---

## Places

| | |
| --- | --- |
| **Primary** | Google Places (New) — **optional**, needs a key |
| **Default** | OpenStreetMap via the Overpass API — **needs nothing** |
| **What OSM gives** | Name, category, coordinates, address, opening hours, phone, website, brand |
| **What OSM does not** | Ratings, review counts, price levels. All null. |
| **Storage** | **Not stored.** Fetched per request, cached by area. |
| **Cache lifetime** | OSM 7 days · Google 1 day |
| **Verify** | `pnpm places:verify [city…]` |

OpenStreetMap is the **default, not the fallback**. It needs no key, so a student
in Kraków gets the same real shops as a student in Madrid on the day the city is
added. Configuring Google adds ratings and a price band on top.

The chain is: fresh cache → Google if configured → OpenStreetMap → a **dated**
stale cache entry → an honest "couldn't reach the map". `searchPlaces` returns a
discriminated union rather than an array, because "there are no pharmacies near
you" and "we could not reach the map" look identical as an empty list and mean
opposite things.

### Licensing, and what it obliges

OpenStreetMap data is **ODbL**. Two obligations, both discharged in code rather
than in a README:

- Every row carries `attribution` — `© OpenStreetMap contributors` — as a
  **field**, so the interface renders it wherever places appear rather than
  wherever somebody remembered.
- Every row carries `sourceUrl`, a link to the object on openstreetmap.org, so
  a student who finds the shop has moved can go and fix it. It is the only
  recommendation in the product that is repairable by the person who noticed.

Results are cached and never republished as a dataset, which keeps this on the
"produced work" side of the licence.

Google's terms allow a place id to be stored indefinitely and other content to
be cached for up to thirty days. The cache uses **one day**, which is inside the
terms and also better data: an opening time cached for a month is wrong for most
of it.

### Etiquette

The public Overpass instances are volunteer-run and their usage policy asks for
moderation. So: one query per search rather than one per category, a server-side
timeout inside the query, a User-Agent naming the project and where to complain,
an eight-second per-endpoint deadline with failover, and a cache in front of all
of it. **A deployment doing real volume should run its own instance** and set
`OVERPASS_URL`.

### What is not counted, deliberately

There is no "places in Madrid" number anywhere in the product, including
`/admin`. Places are not stored, so such a number would be either the size of
the cache — which measures how much the city has been browsed — or an invention.
The admin screen reports which provider answers and how warm the cache is.

---

## Routing

| | |
| --- | --- |
| **Providers** | OSRM (`ROUTING_OSRM_URL`) · Google Routes (on the Places key) |
| **Default** | **None configured** |
| **Without one** | Distances, labelled as distances |

This is the one place where the honest answer is visibly worse than the
dishonest one, and it is worth being clear about the trade.

With no routing provider, a card says "600 m away". With one, it says "8 min
walk". The second is more useful. The product used to show it *always*, computed
by dividing a straight-line distance by 78 metres a minute — which crossed
rivers, ignored motorways, walked through the Palacio Real, and was wrong in
every city with a hill in it.

`ROUTING_OSRM_URL` accepts any OSRM instance. The public demo server at
`router.project-osrm.org` is deliberately **not** a default: its usage policy is
development only.

---

## Events

| | |
| --- | --- |
| **Source** | Student-created rows, plus seeded official recurring facts |
| **Seeded rows** | 32, each with a real venue, real coordinates and a real `sourceUrl` |
| **Social counts** | **Zero on every seeded row.** |
| **External feeds** | **Not connected.** No adapter is configured. |

The seeded events are real things that really recur — the Prado's free evening
window, with a link to the museum's own page saying so. What was **not** real
was the social proof: they carried between seven and forty-one confirmations and
between nineteen and a hundred and twenty-eight interested, none with a student
behind them. Worse, the interface **adds** real responses to the seeded figure,
so three students going rendered as ninety-seven and the three real ones were
the part nobody could see. Every one is now zero.

**An event provider adapter does not exist yet.** This is the largest remaining
gap. The shape to copy is `src/server/work/providers.ts`: a typed adapter that
reads a declared feed, normalises without inventing a field, and records a
`ProviderRun` carrying the real error text on failure.

---

## Work

| | |
| --- | --- |
| **Source** | Student postings, plus any feed in `STUDENTOS_WORK_FEEDS` |
| **Feeds configured** | **None, in any environment.** |
| **Sync** | `/api/cron/work-sync`, daily at 04:17 UTC |
| **Expiry** | `/api/cron/data-upkeep`, daily at 04:42 UTC |

**There is no scraper.** Not a throttled one, not a polite one, not one behind a
flag. A site that has not published a feed has not agreed to be republished. The
consequence is visible and deliberate: with no feed configured the external side
of the board is empty and `/admin` says "Not configured" with the variable name.

Money is nullable throughout. `Opportunity.pay` is `Pay | null` and
`studentFriendly` is `boolean | null`; null means the source did not say, and
the interface renders "Pay not stated" in the same slot and size. Nothing
anywhere infers a wage. The ranking engine scores an unknown **0.5**, never 0
and never a pass.

---

## Deals

| | |
| --- | --- |
| **Source** | Students, with a verification queue |
| **States** | unverified · community-verified · merchant-verified · expired |
| **Expiry** | Removed by `/api/cron/data-upkeep` once `expiresAt` passes |

A deal reaches a student as verified only once independent students confirm it.
`src/domain/truth.ts` is the general layer and `src/domain/reputation.ts`
weights a verification by whether that person has been right before — earned
only by being right, capped at 2.5×, with a one-year half-life.

---

## Prices

| | |
| --- | --- |
| **Source** | `priceObservations` — what students reported paying |
| **Aggregation** | Median, never mean |
| **Floor** | Below three reports it is a rumour and is not shown as a price |

This is the **only** source in the product for what somewhere actually costs,
and it is why the "better option" card can say "saves about €6 a visit, from
student reports" in one city and "a cheaper band, 300 m closer" in another. The
second is not a degraded answer; it is what is known.

City price **anchors** — typical lunch, typical pint — are curated per city in
`src/data/cities.ts` and used only to estimate a plan line that has no price,
always labelled as an estimate.

---

## Neighbourhoods

| | |
| --- | --- |
| **Source** | `src/data/neighbourhoods.ts`, hand-written for five cities |
| **Rent figures** | `basis: "seed-estimate"` on every row, rendered beside the figure |

26 rows across the deep five, with commute minutes per campus and a room rent
band. Every rent band carries its basis and the interface must render it. The
exit from "estimate" is a verified `price` claim with `targetKind:
"neighbourhood"` — a real student reporting real rent.

---

## Language

| | |
| --- | --- |
| **Source** | `src/data/language/*.ts`, written for the product |
| **Coverage** | Spanish, German, French, Italian, Dutch, Portuguese |
| **Selection** | From the city's country, overridable by the student |

Phrases are content rather than data — nobody else's rows and nothing to source
externally. The language follows the city, so a student in Berlin is not offered
Spanish.

---

## Maps

| | |
| --- | --- |
| **Markers** | Real coordinates, projected through Web Mercator |
| **Basemap** | **None by default.** `NEXT_PUBLIC_MAP_TILE_URL` adds one. |

The map used to draw a random city from a seeded PRNG and place pins by
hand-written percentages. Every city had a river through it. The pins are now
projected from real coordinates into a viewport computed from the places
themselves, so relative geography is true and filtering zooms in.

The generated streets are gone rather than kept: under real pins, invented
streets would read as the shops being on them. A grid claims nothing.

There is no default tile URL because OpenStreetMap's own tile servers exist for
the map on their website and their usage policy does not cover an application.

---

## Community

Entirely student-written. Posts, comments, votes, chat, Anyone Down plans,
questions and answers are rows created by real accounts.

`MIN_COHORT = 5` is the invariant that protects it: every count about *other*
students goes through `cohortCount()`, which returns null — never zero — below
the floor. Friends are the deliberate exception, because you know who they are.

A city with no community shows a real empty state, not invented activity.

---

## What the seeder puts in a fresh install

`STUDENTOS_CONTENT_MODE=real` plus durable storage is what turns off the
standing "sample content" notice. Somebody has to review the cities and set it;
connecting a database does not make seeded content real.

| Seeded | Count | Real? |
| --- | --- | --- |
| Events | 32 | Real venues, real source URLs, **zero** social counts |
| Official facts | ~20 | Real government and transport authority links, with check dates |
| Guides | some | Written for the product |
| Communities | 11 | Real rooms, **zero** members |
| Places | **0** | Places are never seeded. They come from a provider. |
| Students | 0 | Except the demo account, and only when `STUDENTOS_DEMO_PASSWORD` is set |

---

## Verifying any of this yourself

```bash
pnpm places:verify        # real searches through the real service
pnpm places:verify berlin krakow
pnpm ai:verify            # two real model calls through the gateway
pnpm db:verify            # a probe write, a read back, a stale write that must be refused
```

Each makes real calls and exits non-zero on failure, so each can gate a deploy.
They exist because every one of these layers is built to **degrade quietly** —
correct behaviour for a student standing in the street, and useless for a
deploy, because every failure state looks calm.
