import { AlertTriangle, ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SaveButton } from "@/components/app/save-button";
import { ApplyControls, ReportOpportunity, StatusPicker } from "@/components/app/work-actions";
import { Badge } from "@/components/ui/primitives";
import { workRightsFor, workRightsDisclaimer } from "@/data/work-rights";
import {
  payPeriodLabel,
  remoteLabel,
  riskFlagCopy,
  scheduleLabel,
  skillLabel,
  verificationMeta,
  workKindMeta,
  workSafety,
} from "@/domain/work";
import {
  componentLabel,
  describeSignal,
  fitWeights,
  languageName,
  rankedShortfalls,
  scoreOpportunity,
} from "@/server/engines/work-match";
import {
  applicationFor,
  commuteLookup,
  hourlyBaseline,
  loadEmployer,
  loadOpportunity,
  loadSavedOpportunityIds,
  loadVerification,
  loadWorkProfile,
} from "@/server/queries/work";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { fmtWhen } from "@/lib/dates";
import { cn, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Opportunity",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * ONE OPPORTUNITY, IN FULL
 * ----------------------------------------------------------------------------
 * Everything the card could not fit, and one thing the card deliberately does
 * not attempt: the score, broken into its eight parts, with the weight of each
 * printed next to it.
 *
 * That breakdown is the argument for this product over a job board. A student
 * who thinks the ordering is wrong can see that Language is worth 16% and that
 * this posting scored 0.10 on it, and either change their profile or disagree
 * with us on the evidence. A percentage with nothing behind it is a slot
 * machine.
 * ============================================================================
 */
export default async function OpportunityPage(props: PageProps<"/work/[id]">) {
  const viewer = await requireViewer();
  const { id } = await props.params;
  const now = requestDate();

  const opportunity = await loadOpportunity(id);
  if (!opportunity) notFound();

  /* A withheld posting is a 404 to everybody but its author, who is told what
     happened rather than left wondering where their gig went. */
  const own = opportunity.postedByUserId === viewer.user.id;
  if (opportunity.moderation !== "published" && !own) notFound();

  const [profile, verification, employer, saved, application, baseline] = await Promise.all([
    loadWorkProfile(viewer.user.id),
    loadVerification(),
    loadEmployer(opportunity.employerId),
    loadSavedOpportunityIds(viewer.user.id),
    applicationFor(viewer.user.id, id),
    hourlyBaseline(viewer.profile.citySlug),
  ]);

  const match = scoreOpportunity(opportunity, {
    profile,
    commuteMinutes: commuteLookup(viewer.profile.citySlug, viewer.profile.campusSlug),
    verification,
    hourlyBaseline: baseline,
    now,
  });

  const where = viewer.currency;
  const fmt = (cents: number) => money(cents / 100, where);
  const rights = workRightsFor(opportunity.countryCode);
  const pay = opportunity.pay;

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link
        href="/work"
        className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950"
      >
        <ArrowLeft className="size-4" />
        Work
      </Link>

      {opportunity.moderation !== "published" ? (
        <p className="mb-5 rounded-2xl bg-amber-soft px-4 py-3 text-[0.875rem] leading-relaxed text-ink-800">
          <strong className="font-semibold">Held for review.</strong> Only you can see this. It is
          waiting on a moderator, either because it was reported or because the wording matched a
          pattern we withhold.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge accent="signal" tone="soft">
          {workKindMeta[opportunity.kind].label}
        </Badge>
        {opportunity.provider === "sample" ? <Badge accent="amber">Sample posting</Badge> : null}
        {opportunity.provider === "students" ? <Badge accent="mint">From a student</Badge> : null}
        <Badge accent="flow" tone="soft">
          {remoteLabel[opportunity.remoteType]}
        </Badge>
      </div>

      <h1 className="mt-3 text-display-xs text-ink-950 sm:text-display-sm">{opportunity.title}</h1>

      <p
        className={cn(
          "tnum mt-2 font-mono text-[1.375rem] font-semibold",
          pay ? "text-ink-950" : "text-ink-400",
        )}
      >
        {pay
          ? `${fmt(pay.minCents)}${pay.maxCents === null ? "" : `–${fmt(pay.maxCents)}`} ${payPeriodLabel[pay.period]}`
          : "Pay not stated"}
      </p>
      {!pay ? (
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-500">
          The source gave no figure. StudentOS does not fill one in, so you would have to ask before
          you commit any time to it.
        </p>
      ) : null}

      {opportunity.employerName ? (
        <p className="mt-3 text-[0.9375rem] text-ink-700">
          {opportunity.employerName}
          {employer ? (
            <span className="ml-2 text-[0.8125rem] text-ink-500">
              · {verificationMeta[employer.verification].label}
            </span>
          ) : null}
        </p>
      ) : null}

      {employer ? (
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-500">
          {verificationMeta[employer.verification].means}
        </p>
      ) : opportunity.provider !== "students" && opportunity.provider !== "sample" ? (
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-500">
          {verificationMeta.unverified.means}
        </p>
      ) : null}

      {/* --- risk ---------------------------------------------------------- */}
      {match.risks.length > 0 ? (
        <section className="mt-5 rounded-2xl bg-amber-soft p-4">
          <h2 className="inline-flex items-center gap-2 text-[0.9375rem] font-semibold text-ink-950">
            <AlertTriangle className="size-4" />
            Read this before you reply
          </h2>
          <ul className="mt-2 space-y-2">
            {match.risks.map((flag) => (
              <li key={flag} className="text-[0.875rem] leading-relaxed text-ink-800">
                <strong className="font-semibold">{riskFlagCopy[flag].label}.</strong>{" "}
                {riskFlagCopy[flag].explain}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-600">
            This is pattern matching on the wording, not a judgement about whoever posted it. It can
            be wrong in both directions.
          </p>
        </section>
      ) : null}

      {/* --- the score ----------------------------------------------------- */}
      <section className="mt-6 rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[0.9375rem] font-semibold text-ink-950">Why this is {match.fit}%</h2>
          <Link href="/work/profile" className="text-[0.8125rem] font-medium text-flow hover:underline">
            Change what it matches on
          </Link>
        </div>

        {match.reasons.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {match.reasons.map((signal, index) => (
              <li
                key={`${signal.kind}-${index}`}
                className="flex gap-2 text-[0.875rem] leading-relaxed text-ink-800"
              >
                <span aria-hidden className="text-mint-deep">
                  ✓
                </span>
                {describeSignal(signal, fmt)}
              </li>
            ))}
          </ul>
        ) : null}

        {match.shortfalls.length > 0 ? (
          <ul className="mt-3 space-y-1.5 border-t border-ink-100 pt-3">
            {rankedShortfalls(match.shortfalls).map((signal, index) => (
              <li
                key={`${signal.kind}-${index}`}
                className="flex gap-2 text-[0.875rem] leading-relaxed text-ink-600"
              >
                <span aria-hidden className="text-ink-300">
                  —
                </span>
                {describeSignal(signal, fmt)}
              </li>
            ))}
          </ul>
        ) : null}

        <details className="mt-4 border-t border-ink-100 pt-3">
          <summary className="cursor-pointer text-[0.8125rem] font-medium text-ink-500 hover:text-ink-950">
            The arithmetic
          </summary>
          <ul className="mt-2.5 space-y-1">
            {(Object.keys(fitWeights) as (keyof typeof fitWeights)[]).map((component) => (
              <li
                key={component}
                className="flex items-baseline justify-between gap-4 text-[0.8125rem] text-ink-600"
              >
                <span>
                  {componentLabel[component]}
                  <span className="ml-1.5 text-ink-400">
                    worth {Math.round(fitWeights[component] * 100)}%
                  </span>
                </span>
                <span className="tnum font-mono">
                  {Math.round(match.components[component] * 100)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[0.75rem] leading-relaxed text-ink-400">
            A component with nothing to go on scores 50, not 0. A posting that says nothing about
            pay is not being punished for it — but it is not being credited either.
          </p>
        </details>
      </section>

      {/* --- the posting --------------------------------------------------- */}
      <section className="mt-6">
        <h2 className="text-[0.9375rem] font-semibold text-ink-950">The posting</h2>
        <p className="mt-2 whitespace-pre-line text-[0.9375rem] leading-relaxed text-ink-700">
          {opportunity.description}
        </p>

        <dl className="mt-4 grid gap-x-6 gap-y-2 text-[0.875rem] sm:grid-cols-2">
          <Row label="Where">
            {opportunity.remoteType === "remote"
              ? "Remote"
              : (opportunity.area ?? "Not given")}
          </Row>
          {opportunity.startsAt ? (
            <Row label="When">{fmtWhen(opportunity.startsAt, viewer.city.timezone, now)}</Row>
          ) : null}
          {opportunity.hoursMin ? (
            <Row label="Hours">
              {opportunity.hoursMax && opportunity.hoursMax !== opportunity.hoursMin
                ? `${opportunity.hoursMin}–${opportunity.hoursMax} a week`
                : `${opportunity.hoursMin} a week`}
            </Row>
          ) : null}
          {opportunity.schedule.length > 0 ? (
            <Row label="Schedule">
              {opportunity.schedule.map((tag) => scheduleLabel[tag]).join(", ")}
            </Row>
          ) : null}
          {opportunity.languages.length > 0 ? (
            <Row label="Languages">
              {opportunity.languages
                .map((entry) => `${languageName(entry.code)} (${entry.level})`)
                .join(", ")}
            </Row>
          ) : null}
          {opportunity.skills.length > 0 ? (
            <Row label="Skills">
              {opportunity.skills.map((skill) => skillLabel[skill]).join(", ")}
            </Row>
          ) : null}
          <Row label="Suits international students">
            {opportunity.internationalStudentFriendly === true
              ? "Yes, it says so"
              : opportunity.internationalStudentFriendly === false
                ? "No, it says not"
                : "The posting does not say"}
          </Row>
        </dl>

        {opportunity.workAuthorizationNotes ? (
          <p className="mt-3 rounded-xl bg-paper-2 px-3 py-2 text-[0.875rem] leading-relaxed text-ink-700">
            <span className="font-medium">What the posting says about work rights: </span>
            {opportunity.workAuthorizationNotes}
          </p>
        ) : null}

        {opportunity.sourceUrl ? (
          <a
            href={opportunity.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-3 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-flow hover:underline"
          >
            <ExternalLink className="size-3.5" />
            The original posting at the source
          </a>
        ) : null}
      </section>

      {/* --- acting -------------------------------------------------------- */}
      <section className="mt-6 space-y-4">
        <ApplyControls
          opportunityId={opportunity.id}
          method={opportunity.applicationMethod}
          applicationUrl={opportunity.applicationUrl}
          isSample={opportunity.provider === "sample"}
          isOwn={own}
          status={application?.status ?? null}
        />

        <div className="flex flex-wrap items-center gap-2">
          <SaveButton kind="opportunity" targetId={opportunity.id} saved={saved.has(opportunity.id)} />
        </div>

        <div>
          <p className="text-[0.8125rem] font-medium text-ink-500">Where you are with it</p>
          <div className="mt-2">
            <StatusPicker opportunityId={opportunity.id} status={application?.status ?? null} />
          </div>
        </div>
      </section>

      {/* --- safety and rights --------------------------------------------- */}
      <section className="mt-8 rounded-2xl bg-paper-2 p-5">
        <h2 className="text-[0.9375rem] font-semibold text-ink-950">Before you commit to anything</h2>
        <ul className="mt-2.5 space-y-1.5 text-[0.875rem] leading-relaxed text-ink-600">
          {workSafety.map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-ink-300" />
              {line}
            </li>
          ))}
        </ul>

        <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-600">{workRightsDisclaimer}</p>
        {rights ? (
          <a
            href={rights.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-flow hover:underline"
          >
            <ExternalLink className="size-3.5" />
            {rights.authority}
          </a>
        ) : null}

        <div className="mt-4">
          <ReportOpportunity opportunityId={opportunity.id} />
        </div>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-ink-950">{children}</dd>
    </div>
  );
}
