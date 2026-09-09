import {
  SEARCH_DESTINATIONS,
  type SearchDestination,
  type SearchGroup,
} from "@/config/search";

/**
 * ============================================================================
 * QUICK COMMAND — ranking
 * ----------------------------------------------------------------------------
 * What the command palette shows for what was typed.
 *
 * Pure, and separated from the component for the usual reason: the interesting
 * part is not the dialog, it is whether typing "nie" finds the arrival
 * checklist and typing "broke" finds survival mode. That is testable without a
 * browser, and it is what actually breaks when someone adds a screen.
 *
 * THE RANKING, IN ORDER OF WHAT IT MEANS:
 *
 *   1. The label starts with what you typed. You know the name, you are
 *      halfway through typing it. Nothing should ever outrank this.
 *   2. A keyword starts with it. You know the thing by another name -- "rent",
 *      "padron", "dm" -- and that name is on the row.
 *   3. The label contains it. "budget" finding "Travel budget".
 *   4. A keyword contains it.
 *   5. The hint contains it. The weakest signal, and last, because a word in a
 *      sentence is usually a coincidence.
 *
 * Ties break on the shorter label, which is very nearly always the more
 * general screen: "Budget" before "Travel budget" for the query "bud".
 *
 * WHAT IT DOES NOT DO. It does not fuzzy-match dropped letters. A palette that
 * answers "wrk" is nice; a palette that answers a typo with a confidently
 * wrong screen is worse than one that answers nothing, because the student
 * ends up somewhere they did not ask for and has to work out why. When
 * nothing matches, the caller offers to ask instead -- which is the honest
 * response and, in this product, the more useful one.
 * ============================================================================
 */

/** Combining marks, built from escapes so this file stays ASCII. */
const COMBINING = new RegExp("[\\u0300-\\u036f]", "g");

/**
 * Apostrophes, straight and curly.
 *
 * They are DELETED rather than turned into a separator, which is the one way
 * this fold differs from the others in the codebase and the reason it is
 * written out here. Collapsing every non-letter to a space turns "what's on"
 * into "what s on", which then matches nothing -- the keyword it is supposed
 * to find is "whats on". Deleting the apostrophe first makes both sides agree,
 * and it is what a student typing an English possessive expects.
 */
const APOSTROPHES = new RegExp("['\\u2019\\u02bc]", "g");

/**
 * Lowercase, strip diacritics, drop apostrophes, collapse the rest to spaces.
 *
 * Written here rather than imported from `@/domain/institutions` so the
 * palette does not drag the institution registry into the browser bundle for
 * the sake of four lines.
 */
export function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING, "")
    .replace(APOSTROPHES, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Higher is better. 0 means the row does not match at all. */
export function scoreDestination(destination: SearchDestination, query: string): number {
  const q = fold(query);
  if (q.length === 0) return 0;

  const label = fold(destination.label);
  if (label.startsWith(q)) return 100;

  const keywords = destination.keywords.map(fold);
  if (keywords.some((keyword) => keyword.startsWith(q))) return 80;

  if (label.includes(q)) return 60;
  if (keywords.some((keyword) => keyword.includes(q))) return 40;
  if (fold(destination.hint).includes(q)) return 20;

  return 0;
}

export type CommandResult = {
  destination: SearchDestination;
  score: number;
};

/**
 * The rows to show for a query, best first.
 *
 * An empty query returns the defaults rather than everything: forty rows in a
 * dialog is a menu, and a student who has just opened it has not asked a
 * question yet.
 */
export function searchDestinations(query: string, limit = 8): CommandResult[] {
  if (fold(query).length === 0) {
    return DEFAULT_DESTINATIONS.map((destination) => ({ destination, score: 0 }));
  }

  return SEARCH_DESTINATIONS.map((destination) => ({
    destination,
    score: scoreDestination(destination, query),
  }))
    .filter((result) => result.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.destination.label.length - b.destination.label.length ||
        a.destination.label.localeCompare(b.destination.label),
    )
    .slice(0, limit);
}

/**
 * What an empty palette offers.
 *
 * The six things a student opens the app to do, not the six screens we would
 * like them to see. Explore and Budget are first because between them they are
 * most of the product's daily use.
 */
const DEFAULT_HREFS = [
  "/discover",
  "/budget",
  "/lifeops",
  "/events",
  "/pulse/chat",
  "/speak",
] as const;

const DEFAULT_DESTINATIONS: readonly SearchDestination[] = DEFAULT_HREFS.map((href) => {
  const found = SEARCH_DESTINATIONS.find((destination) => destination.href === href);
  /* A renamed route should break the build here rather than quietly shorten
     the opening list to five. */
  if (!found) throw new Error(`[command] No destination registered for ${href}`);
  return found;
});

/** Group heading for a result, for the palette's section labels. */
export function groupOf(result: CommandResult): SearchGroup {
  return result.destination.group;
}
