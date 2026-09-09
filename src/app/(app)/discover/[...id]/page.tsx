import { ArrowLeft, ArrowRight, ExternalLink, MapPin, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AnyoneDownButton } from "@/components/app/anyone-down-button";
import { AddToPlanButton } from "@/components/app/event-actions";
import { FeedbackMenu } from "@/components/app/feedback-menu";
import { SaveButton } from "@/components/app/save-button";
import { ShareButton } from "@/components/app/share-button";
import { MascotArt } from "@/components/mascot/mascot-art";
import { PhraseHint } from "@/components/app/phrase-hint";
import { Badge } from "@/components/ui/primitives";
import { PlaceSource, ProviderRating, OpenState } from "@/components/product/place-meta";
import { valueLabel, valueTone } from "@/config/places";
import { describeProximity, priceLevelLabel, priceLevelNote } from "@/domain/places";
import { WALK_METRES_PER_MINUTE } from "@/server/engines/recommend";
import { loadPlace } from "@/server/queries/places";
import { describe as describeRelation, relate } from "@/domain/graph";
import { isStudentVerified } from "@/services/db/schema";
import { betterOption } from "@/server/engines/better-option";
import { loadPlaces, loadRecommendContext } from "@/server/queries/discovery";
import { loadCityGraph, viewerNode } from "@/server/queries/graph";
import { loadMoney } from "@/server/queries/money";
import { loadPlanChoices } from "@/server/queries/plans";
import { findMany, findOne } from "@/server/db";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Place",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * PLACE
 * ----------------------------------------------------------------------------
 * Everything the product knows about one place, and — when there is one — the
 * better option nearby. The match is broken down component by component so a
 * student who disagrees can see which signal was wrong.
 * ============================================================================
 */
/**
 * A CATCH-ALL segment, because a place id contains a slash.
 *
 * The id is `osm:node/26472667` — the provider, then that provider's own
 * identity for the object, which for OpenStreetMap is a path. Percent-encoding
 * the slash into a single dynamic segment does not survive routing: the page
 * 404ed on every real place, which looked like the provider having lost them.
 * The segments are rejoined here and the URL stays readable.
 */
export default async function PlacePage(props: PageProps<"/discover/[...id]">) {
  const viewer = await requireViewer();
  const { id: segments } = await props.params;

  /**
   * The segments arrive PERCENT-ENCODED and have to be decoded one by one.
   *
   * `<Link href="/discover/osm:node/123">` is sent by the browser as
   * `/discover/osm%3Anode/123`, and Next hands the catch-all
   * `["osm%3Anode", "123"]` rather than decoding it. Joining without decoding
   * produced the id `osm%3Anode/123`, which matches nothing, so every place
   * page 404ed — and the 404 looked exactly like the provider having lost the
   * place, which is why it took three test runs to see.
   *
   * Decoding per segment rather than after the join is deliberate: a `%2F`
   * inside one segment is part of that segment's value, not a new segment, and
   * decoding afterwards would silently promote it to a separator.
   */
  const id = (Array.isArray(segments) ? segments : [segments])
    .map((segment) => decodeURIComponent(segment))
    .join("/");

  /* One lookup against the provider, by the id in the URL. A place that no
     longer exists is a 404 rather than a page rendered from a cached name. */
  const place = await loadPlace(id, viewer.profile.citySlug);
  if (!place) notFound();

  const where = viewer.currency;
  const social = !viewer.profile.socialGoals.includes("private");
  const now = requestDate();
  const money$ = await loadMoney(viewer.user.id);

  const context = await loadRecommendContext({
    userId: viewer.user.id,
    profile: viewer.profile,
    budgetCents: money$.unset ? null : money$.reading.safeTodayCents,
  });

  const [scoredAll, saved, mentions, plans, graph, priceReports] = await Promise.all([
    loadPlaces(context),
    findOne("saved", (row) => row.userId === viewer.user.id && row.kind === "place" && row.targetId === id),
    findMany(
      "posts",
      (row) =>
        row.citySlug === viewer.profile.citySlug &&
        row.hiddenAt === null &&
        (row.placeId === id || row.title.toLowerCase().includes(place.name.split(",")[0].toLowerCase())),
    ),
    loadPlanChoices({ userId: viewer.user.id, citySlug: viewer.profile.citySlug, now }),
    loadCityGraph(viewer.profile.citySlug),
    findMany(
      "priceObservations",
      (row) => row.citySlug === viewer.profile.citySlug && row.placeId !== null,
    ),
  ]);

  /* Everything the city graph can honestly say about this student and this
     place: a friend's save, a floored campus count, the area it is in, the
     commute from that area to their campus. Facts, not a score — the match
     percentage above is the score, and it does not explain itself. */
  const relations = relate(graph, viewerNode(graph, viewer.user.id), { kind: "place", id: place.id });

  const scored = scoredAll.places.find((entry) => entry.item.id === id);
  const better = betterOption({
    current: place,
    candidates: scoredAll.places.map((entry) => entry.item),
    maxMetres: Math.max(400, viewer.profile.maxTravelMinutes * 1.6 * WALK_METRES_PER_MINUTE),
    /* Student price reports keyed by place, which is the only source in the
       product for what somewhere actually costs. */
    observed: new Map(
      priceReports.map((row) => [
        row.placeId as string,
        { medianCents: row.amountCents, sampleSize: 3, lastObservedAt: row.observedAt },
      ]),
    ),
  });
  /* No euro price on a place. The band is the strongest claim available. */
  const priceCents = null;
  const safe = money$.unset ? null : money$.reading.safeTodayCents;

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link
        href="/discover"
        className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950"
      >
        <ArrowLeft className="size-4" />
        Discover
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">{place.category}</span>
          {/* The muted band has no accent in the palette, and forcing one
              would give "not enough student data" the same visual weight as a
              finding. It renders as plain text instead. */}
          {place.value.band === "insufficient" ? (
            <span className="text-[0.8125rem] text-ink-400">{valueLabel[place.value.band]}</span>
          ) : (
            <Badge accent={valueTone[place.value.band] as "signal" | "mint" | "amber"}>
              {valueLabel[place.value.band]}
            </Badge>
          )}
          {scored && scored.match >= 60 ? (
            <span className="tnum rounded-full bg-signal-soft px-2.5 py-1 font-mono text-micro font-semibold text-signal-deep">
              {scored.match}% match
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h1 className="text-display-xs text-ink-950 sm:text-display-sm">{place.name}</h1>
          <FeedbackMenu targetKind="place" targetId={place.id} className="mt-1 shrink-0" />
        </div>
      </header>

      {/* ---- facts ---------------------------------------------------------- */}
      <dl className="mt-5 grid grid-cols-3 gap-3">
        {/* Three facts, each of which the provider or our own rows actually
            state. "Typical spend" was the first casualty of the rewrite: there
            is no such figure, and there never was — it was written by hand. */}
        <Fact label="Price band" value={priceLevelLabel(place.priceLevel)} hint={priceLevelNote(place.priceLevel)} />
        <Fact label="Distance" value={describeProximity(place.proximity)} />
        <Fact
          label="Confirmed by"
          value={place.confirmations > 0 ? `${place.confirmations} students` : "Nobody yet"}
        />
      </dl>

      {/* ---- afford line --------------------------------------------------- */}
      {priceCents !== null && priceCents > 0 && safe !== null ? (
        <p className="mt-3 flex items-center gap-2 text-[0.875rem] text-ink-700">
          <MascotArt state={priceCents <= safe ? "neutral" : "warning"} className="size-6" />
          {priceCents <= safe
            ? `Fits today. You have ${money(safe / 100, where)} safe to spend.`
            : `${money(priceCents / 100, where)} is over today's ${money(safe / 100, where)}. `}
          {priceCents > safe ? (
            <Link href={`/budget/afford?amount=${(priceCents / 100).toFixed(2)}`} className="font-medium underline underline-offset-4">
              Check the week
            </Link>
          ) : null}
        </p>
      ) : null}

      {/* ---- why ------------------------------------------------------------ */}
      <section className="mt-5 rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
        <h2 className="text-[1.0625rem] font-semibold text-ink-950">What is known</h2>
        {/* There is no hand-written "why" any more. What is on the row
            instead: the address, the chain, the reasons the value band was
            built from, the opening hours if the provider published ones this
            parser can read, and the rating if enough people are behind it.
            Every line here is traceable to a field on the row. */}
        <dl className="mt-2 flex flex-col gap-1.5 text-[0.9375rem] leading-relaxed text-ink-700">
          {place.address ? <dd>{place.address}</dd> : null}
          {place.brand && place.brand !== place.name ? <dd>Part of {place.brand}</dd> : null}
          {place.value.reasons.length > 0 ? <dd>{place.value.reasons.join(" · ")}</dd> : null}
          {!place.address && place.value.reasons.length === 0 ? (
            <dd className="text-ink-500">
              The provider has a name and a location for this and not much else. Nothing more is
              claimed here than that.
            </dd>
          ) : null}
        </dl>
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          <OpenState place={place} timezone={viewer.city.timezone} now={now} />
          <ProviderRating place={place} />
          {place.website ? (
            <a
              href={place.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[0.8125rem] text-ink-500 underline underline-offset-4"
            >
              Website
              <ExternalLink className="size-3" aria-hidden />
            </a>
          ) : null}
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[0.8125rem]">
          {isStudentVerified(place.confirmations) ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-3 py-1 font-medium text-mint-deep">
              <ShieldCheck className="size-3.5" />
              Student verified · {place.confirmations} confirmations
            </span>
          ) : (
            <span className="text-ink-500">
              {place.confirmations === 0
                ? "No student has confirmed anything here yet. Be the first."
                : `Needs ${10 - place.confirmations} more independent confirmations to be verified.`}
            </span>
          )}
          <PlaceSource place={place} now={now} />
        </p>
      </section>

      {/* ---- how it sits in your city --------------------------------------
           From the city graph rather than from the place row: these are edges
           — who saved it, where it is, how far that is from your campus — and
           every count about other students is floored before it gets here. */}
      {relations.length > 0 ? (
        <section className="mt-3 rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
          <h2 className="flex items-center gap-2 text-[1.0625rem] font-semibold text-ink-950">
            <Users className="size-4 text-ink-400" />
            How this sits in your city
          </h2>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {relations.map((relation) => (
              <li
                key={relation.kind}
                className="rounded-full bg-paper-2 px-3 py-1 text-[0.8125rem] text-ink-700"
              >
                {describeRelation(relation)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- what to say there ---------------------------------------------
           Rendered only when the category has an obvious sentence attached; a
           gym gets nothing rather than something generic. */}
      {/* The category KEY, not the display label: `cheap-eat` rather than
          "Cheap eat". The label is written for a person and changes when
          somebody improves the copy; the key is the taxonomy. */}
      <PhraseHint viewer={viewer} context={{ kind: "place", category: place.categoryKey }} />

      {/* ---- better option -------------------------------------------------- */}
      {better ? (
        <Link
          href={`/discover/${better.place.id}`}
          className="mt-4 flex items-center gap-4 rounded-2xl bg-mint-soft/70 p-5 ring-1 ring-mint-deep/15 transition-shadow hover:shadow-[var(--shadow-raise)]"
        >
          <MascotArt state="excited" className="size-12 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="font-mono text-micro uppercase tracking-[0.1em] text-mint-deep">
              Better value nearby
            </span>
            <span className="mt-0.5 block text-[1rem] font-semibold text-ink-950">
              {better.place.name} · {priceLevelLabel(better.place.priceLevel)}
            </span>
            <span className="mt-0.5 block text-[0.8125rem] text-ink-700">
              {/* A saving figure exists only when students reported prices at
                  both ends. Otherwise the sentence says what is actually
                  known: a cheaper band, and why it is a fair swap. */}
              {better.savingCents !== null
                ? `Saves about ${money(better.savingCents / 100, where)} a visit, from student reports. ${better.why}.`
                : `A cheaper band, ${better.why}.`}
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-mint-deep" />
        </Link>
      ) : null}

      {/* ---- actions -------------------------------------------------------- */}
      <div className="mt-5 flex flex-wrap gap-2">
        <SaveButton kind="place" targetId={place.id} saved={Boolean(saved)} />
        <ShareButton path={`/discover/${place.id}`} title={place.name} />
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, ${viewer.city.name}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3.5 py-2 text-[0.875rem] font-medium text-ink-700 hover:border-ink-300"
        >
          <MapPin className="size-4" />
          Directions
          <ExternalLink className="size-3" />
        </a>
        <AddToPlanButton refKind="place" refId={place.id} plans={plans} title={place.name} />
      </div>

      {social ? (
        <div className="mt-5">
          <AnyoneDownButton anchorKind="place" anchorId={place.id} title={place.name} />
        </div>
      ) : null}

      {/* ---- match breakdown ------------------------------------------------ */}
      {scored ? (
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
          <h2 className="text-[1.0625rem] font-semibold text-ink-950">How it scored for you</h2>
          <p className="mt-1 mb-4 text-[0.8125rem] text-ink-500">
            Every recommendation is scored on these, then explained. Nothing is a black box.
          </p>
          <ul className="space-y-2.5">
            {(
              [
                ["budgetFit", "Fits your budget"],
                ["interestFit", "Matches your interests"],
                ["distanceFit", "Close enough"],
                ["studentValue", "Student value"],
                ["communityFit", "Backed by students"],
                ["freshness", "Recently confirmed"],
              ] as const
            ).map(([key, label]) => (
              <li key={key} className="flex items-center gap-3">
                <span className="w-40 shrink-0 text-[0.8125rem] text-ink-600">{label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <span className="block h-full rounded-full bg-signal" style={{ width: `${Math.round(scored.components[key] * 100)}%` }} />
                </span>
                <span className="tnum w-9 shrink-0 text-right font-mono text-[0.75rem] text-ink-400">
                  {Math.round(scored.components[key] * 100)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- students said -------------------------------------------------- */}
      {mentions.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-3 text-[1.0625rem] font-semibold text-ink-950">Students said</h2>
          <ul className="space-y-2">
            {mentions.slice(0, 4).map((post) => (
              <li key={post.id}>
                <Link href={`/pulse/${post.id}`} className="block rounded-xl bg-white p-4 ring-1 ring-ink-950/6 hover:shadow-[var(--shadow-raise)]">
                  <span className="block text-[0.9375rem] font-medium text-ink-900">{post.title}</span>
                  {post.body ? <span className="mt-0.5 line-clamp-2 block text-[0.8125rem] text-ink-600">{post.body}</span> : null}
                  <span className="mt-1 block text-[0.75rem] text-ink-400">{post.commentCount} replies · {post.upvotes} upvotes</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-white p-3.5 ring-1 ring-ink-950/6" title={hint}>
      <dt className="font-mono text-micro uppercase tracking-[0.08em] text-ink-400">{label}</dt>
      <dd className="mt-1 text-[0.9375rem] font-medium text-ink-900">{value}</dd>
    </div>
  );
}
