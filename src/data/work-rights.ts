/**
 * ============================================================================
 * WORK RIGHTS
 * ----------------------------------------------------------------------------
 * Where to find the rule. Never the rule itself.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE ARE NO HOUR LIMITS IN THIS FILE
 *
 * How many hours an international student may work depends on their
 * nationality, their visa or permit type, their course level, whether the work
 * is on campus, whether it is a required placement, and the time of year. Any
 * summary short enough to fit on a card is wrong for somebody reading it, and
 * the person it is wrong for is the person who acts on it and loses their
 * permission to stay.
 *
 * So this product does not answer the question. It does the thing that is
 * genuinely hard for a student in their second week in a foreign country and
 * that no model should be trusted with: it names the authority that decides,
 * and links to that authority's own page. Finding the right official source
 * among a hundred agency blogs is most of the work, and it is work we can do
 * without being wrong.
 *
 * `summary` exists in the type and is `null` in every row. It is there so a
 * verified, dated, human-written summary can be added later — with the
 * `checkedOn` date that authorises it — not so a future contributor can fill
 * it in from memory. A summary without a check date must never render.
 *
 * ---------------------------------------------------------------------------
 * ON `checkedOn`
 *
 * Every URL below was fetched and confirmed to resolve to a live page on the
 * named authority's own domain on the date recorded. That is precisely what
 * the date attests to: the link works and belongs to that authority. It is not
 * a claim that anybody read, understood or verified the contents.
 * ============================================================================
 */

export type WorkRightsSource = {
  countryCode: string;
  country: string;
  /** The body that actually decides, in its own language where that is how a student will see it. */
  authority: string;
  url: string;
  /** ISO date the link was last confirmed to resolve. Never optional. */
  checkedOn: string;
  /**
   * A dated, human-verified summary of the rule.
   *
   * Null everywhere, deliberately. See the header: this is a slot for a
   * checked fact, not a place to paraphrase what one half-remembers.
   */
  summary: string | null;
};

const CHECKED = "2026-09-07";

export const workRightsSources: readonly WorkRightsSource[] = [
  {
    countryCode: "ES",
    country: "Spain",
    authority: "Ministerio de Inclusión, Seguridad Social y Migraciones",
    url: "https://www.inclusion.gob.es/web/migraciones/w/estancia-por-estudios",
    checkedOn: CHECKED,
    summary: null,
  },
  {
    countryCode: "GB",
    country: "United Kingdom",
    authority: "UK Government (GOV.UK)",
    url: "https://www.gov.uk/student-visa/work",
    checkedOn: CHECKED,
    summary: null,
  },
  {
    countryCode: "NL",
    country: "Netherlands",
    authority: "Immigratie- en Naturalisatiedienst (IND)",
    url: "https://ind.nl/en/residence-permits/study",
    checkedOn: CHECKED,
    summary: null,
  },
  {
    countryCode: "DE",
    country: "Germany",
    authority: "Bundesamt für Migration und Flüchtlinge (BAMF)",
    url: "https://www.bamf.de/EN/Themen/MigrationAufenthalt/migrationaufenthalt-node.html",
    checkedOn: CHECKED,
    summary: null,
  },
] as const;

export function workRightsFor(countryCode: string): WorkRightsSource | undefined {
  return workRightsSources.find((source) => source.countryCode === countryCode.toUpperCase());
}

/**
 * The standing line beside every work-rights link, and beside the work-hours
 * field in the work profile.
 *
 * Not dismissible, and phrased as a description of our own limits rather than
 * as a warning about theirs. "We cannot tell you" is true and checkable;
 * "check your eligibility" alone reads as boilerplate people scroll past.
 */
export const workRightsDisclaimer =
  "How many hours you may work depends on your nationality, your permit and your course. StudentOS does not calculate that and cannot tell you what applies to you — only the authority below can.";

/**
 * Shown when a student's country has no row yet.
 *
 * A visible gap, not a silent one: a student in a city we have not written up
 * should be told that, rather than shown a screen with nothing on it and left
 * to assume there is no rule.
 */
export const noWorkRightsSource =
  "Nobody has written up the official source for this country yet. Search for your country's immigration authority — not an agency or a blog — before taking on paid work.";
