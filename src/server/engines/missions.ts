import type { Place } from "@/data/types";
import { describeProximity } from "@/domain/places";
import {
  type MissionStep,
  type MissionStepTemplate,
  type MissionTemplate,
  type MissionVariant,
} from "@/domain/missions";
import type { Cents, CityEvent, Invite } from "@/domain/types";
import { fmtShortDay } from "@/lib/dates";
import type { Scored } from "@/server/engines/recommend";

/**
 * ============================================================================
 * MISSION ENGINE
 * ----------------------------------------------------------------------------
 * Turns a template into steps built from the city's real rows.
 *
 * Pure and deterministic: the same candidates, template and variant always
 * produce the same mission, which is what lets "Make cheaper" and "Make more
 * social" be honest re-runs rather than a model improvising.
 *
 * The rule the whole file obeys: a slot the rows cannot fill is never faked.
 * A required "free museum" slot in a city with no free museum row becomes an
 * open task pointing at the events list; an optional one is dropped. Nothing
 * ever prints a place that does not exist.
 * ============================================================================
 */

export type MissionCandidates = {
  places: readonly Scored<Place>[];
  events: readonly Scored<CityEvent>[];
  invites: readonly (Invite & { going: number })[];
};

export type BuiltStep = Omit<MissionStep, "id" | "missionId">;

export type BuiltMission = {
  steps: BuiltStep[];
  budgetCents: Cents | null;
  totalCents: Cents;
  /** True when even the cheapest fill does not fit the budget. Shown, never hidden. */
  overBudget: boolean;
};

/**
 * How much a euro-priced template scales in this city. Derived from the
 * city's own lunch anchor against a €10 reference lunch, clamped so a data
 * gap cannot produce a ¥3 weekend or a €300 one.
 */
export function cityRatio(anchors: { lunch: [number, number] } | null): number {
  if (!anchors) return 1;
  const mid = (anchors.lunch[0] + anchors.lunch[1]) / 2;
  return Math.max(0.5, Math.min(150, mid / 10));
}

function scaled(cents: Cents, ratio: number): Cents {
  return Math.round((cents * ratio) / 50) * 50;
}

const DAY_MS = 86_400_000;

/**
 * What a place costs, which is nothing we know.
 *
 * A mission step priced from a place used to read `place.price`. There is no
 * such field: a provider publishes a band, not an amount. A step whose
 * template states a price keeps that (it is the mission's own budget line,
 * scaled to the city); a step that relied on the place for a figure now
 * carries none, and the mission total says so.
 */
/**
 * What a place costs, which is nothing we know.
 *
 * A mission step priced from a place used to read `place.price`. There is no
 * such field: a provider publishes a BAND, not an amount. So the two rules
 * that used to be expressed in euros are expressed in the terms that survive:
 *
 *   `free`     the free LAYER — somewhere you can walk into without paying,
 *              which is a park or a public library. It is not "cheap", and a
 *              price of zero was never how a place proved it.
 *   `cheaper`  the provider's price band, with an unknown band sorting behind
 *              both known ones, because "nobody published a price" is not a
 *              claim to be cheap.
 *
 * A step whose template states a price keeps it: that is the mission's own
 * budget line, scaled to the city, and it was never a claim about the place.
 */
const isFreeToEnter = (place: Place) => place.layers.includes("free");

/** 1-4 from the provider, with an unknown band sorting last. */
const priceBand = (place: Place) => place.priceLevel ?? 3;

function pickPlace(
  step: MissionStepTemplate,
  candidates: readonly Scored<Place>[],
  used: Set<string>,
  ratio: number,
  variant: MissionVariant,
): Scored<Place> | null {
  const pick = step.pick ?? {};
  const ceiling = pick.maxCents === undefined ? null : scaled(pick.maxCents, ratio) * (variant.cheaper ? 0.7 : 1);
  const matches = candidates.filter((entry) => {
    const place = entry.item;
    if (used.has(place.id)) return false;
    if (pick.layers && !place.layers.some((layer) => pick.layers?.includes(layer))) return false;
    if (pick.free && !isFreeToEnter(place)) return false;
    /* The ceiling is a euro figure from the mission template and a place has
       no euro figure to compare it against. A tight ceiling therefore steers
       towards the cheap band rather than excluding on a number nobody has. */
    if (ceiling !== null && ceiling <= 500 && priceBand(place) > 1) return false;
    return true;
  });
  if (matches.length === 0) return null;
  /* Cheaper: the cheapest that still scores decently. Otherwise: best match. */
  const sorted = variant.cheaper
    ? [...matches].sort((a, b) => priceBand(a.item) - priceBand(b.item) || b.match - a.match)
    : matches;
  return sorted[0];
}

function pickEvent(
  step: MissionStepTemplate,
  candidates: readonly Scored<CityEvent>[],
  used: Set<string>,
  ratio: number,
  variant: MissionVariant,
  now: Date,
): Scored<CityEvent> | null {
  const pick = step.pick ?? {};
  const horizon = now.getTime() + (pick.withinDays ?? 7) * DAY_MS;
  const ceiling = pick.maxCents === undefined ? null : scaled(pick.maxCents, ratio) * (variant.cheaper ? 0.7 : 1);
  const wantFree = pick.free || variant.cheaper;

  let matches = candidates.filter((entry) => {
    const event = entry.item;
    if (used.has(event.id)) return false;
    if (Date.parse(event.startsAt) > horizon || Date.parse(event.startsAt) < now.getTime() - 3_600_000) return false;
    if (pick.eventTags && ![event.kind, ...event.tags].some((tag) => pick.eventTags?.includes(tag))) return false;
    if (pick.free && event.priceCents !== 0) return false;
    /* A mission is a budget that adds up, and an event whose source published
       no price cannot be added to one: counting it as zero understates the
       mission and guessing a figure invents it. The template slot is dropped
       instead, which is what this engine already does for a slot the city
       cannot fill honestly. */
    if (event.priceCents === null) return false;
    if (ceiling !== null && event.priceCents > ceiling) return false;
    return true;
  });
  if (matches.length === 0) return null;

  if (wantFree && matches.some((entry) => entry.item.priceCents === 0)) {
    matches = matches.filter((entry) => entry.item.priceCents === 0);
  }
  if (variant.social || pick.social) {
    matches = [...matches].sort((a, b) => b.item.interested - a.item.interested || b.match - a.match);
  } else if (variant.cheaper) {
    matches = [...matches].sort(
      (a, b) =>
        (a.item.priceCents ?? Number.POSITIVE_INFINITY) -
          (b.item.priceCents ?? Number.POSITIVE_INFINITY) || b.match - a.match,
    );
  }
  return matches[0];
}

/* -------------------------------------------------------------------------- */
/* Build                                                                       */
/* -------------------------------------------------------------------------- */

export function buildMission(input: {
  template: MissionTemplate;
  candidates: MissionCandidates;
  variant: MissionVariant;
  now: Date;
  /** The city's zone, so "Sat 12 Sep" on a step is the city's Saturday. */
  timeZone: string;
  ratio: number;
  social: boolean;
  fmt: (cents: Cents) => string;
}): BuiltMission {
  const { template, candidates, variant, now, ratio, fmt, timeZone } = input;
  const used = new Set<string>();
  const steps: BuiltStep[] = [];
  const budgetCents = template.budgetCents === null ? null : scaled(template.budgetCents, ratio);

  template.steps.forEach((step, order) => {
    const base = {
      order,
      key: step.key,
      label: step.label,
      detail: null as string | null,
      kind: step.kind,
      priceCents: 0,
      refKind: null as BuiltStep["refKind"],
      refId: null as string | null,
      href: step.href ?? null,
      optional: Boolean(step.optional),
      official: Boolean(step.official),
      doneAt: null,
      skippedAt: null,
    };

    switch (step.kind) {
      case "transport":
      case "buffer": {
        const cents = scaled(step.priceCents ?? 0, ratio);
        steps.push({ ...base, priceCents: variant.cheaper && step.kind === "buffer" ? Math.round(cents / 2 / 50) * 50 : cents });
        return;
      }
      case "place": {
        const found = pickPlace(step, candidates.places, used, ratio, variant);
        if (found) {
          used.add(found.item.id);
          /* The template's own price, scaled to this city, or zero — because
             a place commits no money by being on a plan. */
          const cents = step.priceCents !== undefined ? scaled(step.priceCents, ratio) : 0;
          steps.push({
            ...base,
            label: `${step.label}: ${found.item.name}`,
            detail: `${found.item.value.reasons.join(" · ") || found.item.category} · ${describeProximity(found.item.proximity)}`,
            priceCents: cents,
            refKind: "place",
            refId: found.item.id,
            href: `/discover/${found.item.id}`,
          });
          return;
        }
        if (step.optional) return;
        const layer = step.pick?.layers?.[0];
        steps.push({
          ...base,
          kind: "task",
          detail: "No matching place in the rows yet. Pick one and it counts.",
          href: layer ? `/discover?tab=${layer === "cheap-food" ? "food" : layer}` : "/discover",
        });
        return;
      }
      case "event": {
        const found = pickEvent(step, candidates.events, used, ratio, variant, now);
        if (found) {
          used.add(found.item.id);
          steps.push({
            ...base,
            label: `${step.label}: ${found.item.title}`,
            detail: `${found.item.venue} · ${fmtShortDay(found.item.startsAt, timeZone)}${
              found.item.interested >= 5 ? ` · ${found.item.interested} interested` : ""
            }`,
            /* Guaranteed by the candidate filter, which drops unpriced events
               because a mission has to add up. Restated here because the type
               cannot carry a fact established in another function. */
            priceCents: found.item.priceCents ?? 0,
            refKind: "event",
            refId: found.item.id,
            href: `/events/${found.item.id}`,
          });
          return;
        }
        if (step.optional) return;
        steps.push({
          ...base,
          kind: "task",
          detail: "Nothing matching in the events rows this week. Pick one from the radar and it counts.",
          href: step.pick?.free ? "/events?tab=free" : "/events",
        });
        return;
      }
      case "social": {
        /* A social slot prefers a real open plan someone is short a person for. */
        const invite = (variant.social || input.social)
          ? candidates.invites.find((row) => !used.has(row.id) && row.capacity - row.going > 0 && Date.parse(row.startsAt) > now.getTime())
          : undefined;
        if (invite && step.href === "/anyone-down") {
          used.add(invite.id);
          steps.push({
            ...base,
            label: `${step.label}: ${invite.title}`,
            detail: `${invite.going} in · ${invite.capacity - invite.going} ${invite.capacity - invite.going === 1 ? "spot" : "spots"} left`,
            priceCents: invite.budgetCents ?? 0,
            refKind: "invite",
            refId: invite.id,
            href: `/anyone-down/${invite.id}`,
          });
          return;
        }
        steps.push(base);
        return;
      }
      default:
        steps.push(base);
    }
  });

  /* ---- fit the budget --------------------------------------------------- */
  let total = steps.reduce((sum, step) => sum + step.priceCents, 0);
  let overBudget = false;
  if (budgetCents !== null && total > budgetCents) {
    /* Trim the buffer first, then drop optional paid steps, cheapest saving first. */
    const buffer = steps.find((step) => step.kind === "buffer");
    if (buffer) {
      const cut = Math.min(buffer.priceCents, total - budgetCents);
      buffer.priceCents -= cut;
      total -= cut;
    }
    for (const step of [...steps].filter((s) => s.optional && s.priceCents > 0).sort((a, b) => b.priceCents - a.priceCents)) {
      if (total <= budgetCents) break;
      step.skippedAt = now.toISOString();
      total -= step.priceCents;
    }
    overBudget = total > budgetCents;
  }

  if (overBudget && budgetCents !== null) {
    const over = steps.find((step) => step.kind === "buffer");
    if (over) over.detail = `Over by ${fmt(total - budgetCents)} even with the buffer gone. Swap a paid step for a free one.`;
  }

  return { steps, budgetCents, totalCents: total, overBudget };
}
