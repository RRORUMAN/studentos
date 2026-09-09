import type { Campus, Neighbourhood, TraitBand } from "@/data/types";
import type { ClaimSubject } from "@/domain/truth";

/**
 * ============================================================================
 * STUDENT CITY GRAPH
 * ----------------------------------------------------------------------------
 * The relationships between things the product already stores, indexed once so
 * a recommendation can say *why* instead of only *how much*.
 *
 * The problem this fixes. `engines/recommend.ts` scores every candidate in
 * isolation: price against budget, distance against tolerance, category
 * against interests. Those are all properties of the item. None of them can
 * express "two of your friends saved it", "it is in the area you live in", or
 * "it is nine minutes from your campus and twelve students confirmed the
 * price this month" — and those are precisely the sentences that make a
 * recommendation feel like it came from someone who knows you rather than
 * from a filter. Every one of them is an *edge*, and edges need an index.
 *
 * What this is not. There is no graph database here and there does not need to
 * be: a city is a few thousand nodes, the whole structure is maps of sets, and
 * it is rebuilt from rows the product already has. Nothing in this file does
 * I/O — `buildCityGraph` takes everything it needs, which is what makes it
 * testable and what lets the query layer cache the result per city.
 *
 * ---------------------------------------------------------------------------
 * TWO RULES THIS FILE ENFORCES
 *
 *   1. AGGREGATES HAVE A FLOOR. Any count that describes *other students* is
 *      withheld below `MIN_COHORT`. "One student from your campus saved this"
 *      in a city with four users is not a statistic, it is a name with the
 *      label removed. `cohortCount()` is the only way to read those numbers
 *      and it applies the floor itself, so a component cannot forget to.
 *
 *      Friends are the deliberate exception: a friend is someone the student
 *      already knows they know, so "saved by 2 friends" reveals nothing that
 *      the friends list does not. It is still a count, never a name, unless
 *      the caller asks for names it is entitled to.
 *
 *   2. RELATIONS ARE FACTS, NOT SENTENCES. `relate()` returns typed rows and
 *      `describe()` turns one into English. Keeping them apart means the AI
 *      layer and the card component are reasoning over the same facts, and a
 *      relation the product cannot support simply cannot be constructed.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Node addressing                                                             */
/* -------------------------------------------------------------------------- */

export type GraphNodeKind = "student" | "campus" | "neighbourhood" | "place" | "event" | "deal";

/** `"place:mad-ramen"`. One string key so every index is a plain Map. */
export type NodeKey = string;

export function key(kind: GraphNodeKind, id: string): NodeKey {
  return `${kind}:${id}`;
}

/* -------------------------------------------------------------------------- */
/* Privacy floor                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The smallest group the product will describe out loud.
 *
 * Five is not arbitrary. Below it, a student who knows two of the people in a
 * count can subtract them and learn something about a specific third person —
 * which is the failure mode aggregate counts exist to prevent. Every count in
 * this file that is about other people passes through `cohortCount`.
 */
export const MIN_COHORT = 5;

/**
 * A count safe to render, or null when the group is too small to describe.
 *
 * Null is not zero and the UI must not print it as one: "0 students" is a
 * claim about the city, "we are not saying" is a claim about our threshold.
 */
export function cohortCount(count: number): number | null {
  return count >= MIN_COHORT ? count : null;
}

/* -------------------------------------------------------------------------- */
/* Inputs                                                                      */
/* -------------------------------------------------------------------------- */

/** A save, an RSVP or anything else that links a student to a thing. */
export type GraphSave = {
  userId: string;
  targetKind: GraphNodeKind;
  targetId: string;
};

/**
 * A student in this city, as the graph sees them.
 *
 * Deliberately four fields. The graph never holds a home point, a budget or a
 * transaction: it answers "who is near what" at the resolution of a
 * neighbourhood, and anything finer than that is a location trail waiting to
 * be leaked by a feature nobody has written yet.
 */
export type GraphStudent = {
  userId: string;
  campusSlug: string | null;
  /** Coarse area only, and only when the student chose to share it. */
  areaSlug: string | null;
  /** Excluded from every aggregate when false. */
  discoverable: boolean;
};

/** The part of a published claim the graph needs. */
export type GraphClaim = {
  id: string;
  targetKind: GraphNodeKind | null;
  targetId: string | null;
  subject: ClaimSubject;
  statement: string;
  amountCents: number | null;
  /** Distinct people who confirmed it. Already assessed upstream. */
  verifiers: number;
};

export type GraphInput = {
  citySlug: string;
  campuses: readonly Campus[];
  areas: readonly Neighbourhood[];
  students: readonly GraphStudent[];
  saves: readonly GraphSave[];
  /** Undirected pairs. Both directions are indexed on build. */
  friendships: readonly { a: string; b: string }[];
  /** Published, publishable claims only — see `loadPublishedClaims`. */
  claims: readonly GraphClaim[];
  now: Date;
};

/* -------------------------------------------------------------------------- */
/* The graph                                                                   */
/* -------------------------------------------------------------------------- */

export type CityGraph = {
  citySlug: string;
  builtAt: Date;
  areas: ReadonlyMap<string, Neighbourhood>;
  campuses: ReadonlyMap<string, Campus>;
  /** node -> the students who saved it. */
  saversOf: ReadonlyMap<NodeKey, ReadonlySet<string>>;
  /** student -> their friends. Both directions. */
  friendsOf: ReadonlyMap<string, ReadonlySet<string>>;
  studentsById: ReadonlyMap<string, GraphStudent>;
  /** campus slug -> discoverable students studying there. */
  studentsByCampus: ReadonlyMap<string, ReadonlySet<string>>;
  /** area slug -> discoverable students living there. */
  studentsByArea: ReadonlyMap<string, ReadonlySet<string>>;
  claimsOf: ReadonlyMap<NodeKey, readonly GraphClaim[]>;
};

function push<K, V>(map: Map<K, V[]>, k: K, v: V): void {
  const existing = map.get(k);
  if (existing) existing.push(v);
  else map.set(k, [v]);
}

function add<K>(map: Map<K, Set<string>>, k: K, v: string): void {
  const existing = map.get(k);
  if (existing) existing.add(v);
  else map.set(k, new Set([v]));
}

/**
 * Index everything once.
 *
 * Linear in the number of rows and allocation-heavy exactly once per city per
 * cache window, which is the trade this whole design is making: one pass at
 * build time so that every subsequent `relate()` is a handful of map lookups
 * rather than a scan. A Home feed for a thousand students stays a thousand
 * cheap reads of one shared structure.
 */
export function buildCityGraph(input: GraphInput): CityGraph {
  const saversOf = new Map<NodeKey, Set<string>>();
  for (const save of input.saves) {
    add(saversOf, key(save.targetKind, save.targetId), save.userId);
  }

  const friendsOf = new Map<string, Set<string>>();
  for (const { a, b } of input.friendships) {
    add(friendsOf, a, b);
    add(friendsOf, b, a);
  }

  const studentsById = new Map<string, GraphStudent>();
  const studentsByCampus = new Map<string, Set<string>>();
  const studentsByArea = new Map<string, Set<string>>();
  for (const student of input.students) {
    studentsById.set(student.userId, student);
    if (!student.discoverable) continue;
    if (student.campusSlug) add(studentsByCampus, student.campusSlug, student.userId);
    if (student.areaSlug) add(studentsByArea, student.areaSlug, student.userId);
  }

  const claimsOf = new Map<NodeKey, GraphClaim[]>();
  for (const claim of input.claims) {
    if (!claim.targetKind || !claim.targetId) continue;
    push(claimsOf, key(claim.targetKind, claim.targetId), claim);
  }

  return {
    citySlug: input.citySlug,
    builtAt: input.now,
    areas: new Map(input.areas.map((area) => [area.slug, area])),
    campuses: new Map(input.campuses.map((campus) => [campus.slug, campus])),
    saversOf,
    friendsOf,
    studentsById,
    studentsByCampus,
    studentsByArea,
    claimsOf,
  };
}

/** An empty graph, for a city with nothing in it yet. Never null. */
export function emptyGraph(citySlug: string, now: Date): CityGraph {
  return buildCityGraph({
    citySlug,
    campuses: [],
    areas: [],
    students: [],
    saves: [],
    friendships: [],
    claims: [],
    now,
  });
}

/* -------------------------------------------------------------------------- */
/* Relations                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * One reason this thing is connected to this student.
 *
 * A closed union, because the set of things the product is willing to assert
 * about a relationship is a product decision and should be reviewable in one
 * place. Adding a member here is the moment to ask whether we can actually
 * support the sentence.
 */
export type Relation =
  /** The student's campus is this far from where the thing is. */
  | { kind: "commute"; minutes: number; campusName: string }
  /** It sits in a named area. */
  | { kind: "in-area"; areaSlug: string; areaName: string }
  /** It sits in the area the student lives in. */
  | { kind: "home-area"; areaName: string }
  /** Students at the same campus saved it. Floored. */
  | { kind: "campus-saves"; count: number; campusName: string }
  /** The student's own friends saved it. Not floored; see the header. */
  | { kind: "friend-saves"; count: number }
  /** A published claim about it that students have confirmed. */
  | { kind: "confirmed"; subject: ClaimSubject; statement: string; verifiers: number }
  /** How many students live in the area it sits in. Floored. */
  | { kind: "area-density"; count: number; areaName: string }
  /** How the area scores on something the student said they cared about. */
  | { kind: "area-trait"; label: string; band: TraitBand };

export type RelateOptions = {
  /** Cap on how many relations come back, strongest first. */
  limit?: number;
  /**
   * The area this target is in, supplied by the caller.
   *
   * The graph used to carry an `areaOf` index instead, built by fetching three
   * hundred of the city's places on every graph build and looking up each
   * one's area. That cost a provider round trip on every page that touched the
   * graph, answered nothing for any place outside the sample, and — once the
   * area lookup itself broke — answered nothing for any place at all.
   *
   * A caller rendering a place already holds it and its coordinates, so it can
   * answer the question directly and for free. Omitted or null means "not
   * known", and the area, commute and density relations are simply not
   * produced. They are never guessed.
   */
  areaSlug?: string | null;
};

/**
 * Everything the graph can honestly say about this student and this thing.
 *
 * Ordered by how much a student would care, not by how impressive it sounds:
 * a friend having saved something beats any aggregate, and an aggregate beats
 * a geometric fact. The caller renders the first two or three.
 */
export function relate(
  graph: CityGraph,
  viewer: GraphStudent,
  target: { kind: GraphNodeKind; id: string },
  options: RelateOptions = {},
): readonly Relation[] {
  const node = key(target.kind, target.id);
  const relations: Relation[] = [];

  const savers = graph.saversOf.get(node);
  const friends = graph.friendsOf.get(viewer.userId);

  if (savers && friends) {
    let count = 0;
    for (const saver of savers) if (friends.has(saver)) count += 1;
    if (count > 0) relations.push({ kind: "friend-saves", count });
  }

  if (savers && viewer.campusSlug) {
    const cohort = graph.studentsByCampus.get(viewer.campusSlug);
    const campus = graph.campuses.get(viewer.campusSlug);
    if (cohort && campus) {
      let count = 0;
      for (const saver of savers) {
        if (saver !== viewer.userId && cohort.has(saver)) count += 1;
      }
      const safe = cohortCount(count);
      if (safe !== null) relations.push({ kind: "campus-saves", count: safe, campusName: campus.shortName });
    }
  }

  const claims = graph.claimsOf.get(node) ?? [];
  const best = [...claims].sort((a, b) => b.verifiers - a.verifiers)[0];
  if (best) {
    relations.push({
      kind: "confirmed",
      subject: best.subject,
      statement: best.statement,
      verifiers: best.verifiers,
    });
  }

  const areaSlug = options.areaSlug;
  const area = areaSlug ? graph.areas.get(areaSlug) : undefined;
  if (area) {
    if (viewer.areaSlug === area.slug) {
      relations.push({ kind: "home-area", areaName: area.name });
    } else {
      relations.push({ kind: "in-area", areaSlug: area.slug, areaName: area.name });
    }

    if (viewer.campusSlug) {
      const minutes = area.commuteMinutes[viewer.campusSlug];
      const campus = graph.campuses.get(viewer.campusSlug);
      if (minutes !== undefined && campus) {
        relations.push({ kind: "commute", minutes, campusName: campus.shortName });
      }
    }

    const density = cohortCount(graph.studentsByArea.get(area.slug)?.size ?? 0);
    if (density !== null) {
      relations.push({ kind: "area-density", count: density, areaName: area.name });
    }
  }

  return options.limit === undefined ? relations : relations.slice(0, options.limit);
}

/**
 * One relation as a student would read it.
 *
 * Present tense, no adjectives, and the number is always the thing the sentence
 * is about. The AI layer is handed the `Relation`, not this string, so that it
 * can compose rather than quote.
 */
export function describe(relation: Relation): string {
  switch (relation.kind) {
    case "commute":
      return `${relation.minutes} min from ${relation.campusName}`;
    case "in-area":
      return `In ${relation.areaName}`;
    case "home-area":
      return `In your area`;
    case "campus-saves":
      return `Saved by ${relation.count} students at ${relation.campusName}`;
    case "friend-saves":
      return relation.count === 1 ? `Saved by a friend` : `Saved by ${relation.count} friends`;
    case "confirmed":
      return `${relation.statement} — confirmed by ${relation.verifiers}`;
    case "area-density":
      return `${relation.count} students live in ${relation.areaName}`;
    case "area-trait":
      return `${relation.label}: ${relation.band}/4`;
  }
}

/* -------------------------------------------------------------------------- */
/* Aggregate reads                                                             */
/* -------------------------------------------------------------------------- */

/**
 * How many discoverable students live in each area, floored.
 *
 * Areas below the floor are absent from the map rather than present with zero,
 * so a caller iterating it cannot accidentally render "Wedding: 0 students"
 * and imply the product looked and found nobody.
 */
export function areaDensity(graph: CityGraph): ReadonlyMap<string, number> {
  const out = new Map<string, number>();
  for (const [slug, students] of graph.studentsByArea) {
    const safe = cohortCount(students.size);
    if (safe !== null) out.set(slug, safe);
  }
  return out;
}

/**
 * The claim the product is most confident about for a node, or null.
 *
 * Used by the place card and by the AI tool layer, which is the point of it
 * being here: two surfaces that disagree about which fact to lead with is how
 * a student ends up seeing one price on Explore and another in Ask.
 */
export function leadClaim(graph: CityGraph, kind: GraphNodeKind, id: string): GraphClaim | null {
  const claims = graph.claimsOf.get(key(kind, id));
  if (!claims || claims.length === 0) return null;
  return [...claims].sort((a, b) => b.verifiers - a.verifiers)[0] ?? null;
}
