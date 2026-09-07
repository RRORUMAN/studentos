import { ClipboardList, Plus, ShieldCheck, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Empty } from "@/components/app/cards";
import { EarnPanel } from "@/components/app/earn-panel";
import { WorkCard } from "@/components/app/work-card";
import { MascotArt } from "@/components/mascot/mascot-art";
import { workSafety } from "@/domain/work";
import { type WorkView, inView, workViewLabel, workViews } from "@/server/engines/work-match";
import { loadWorkFeed } from "@/server/queries/work";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { fmtWhen } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Work",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * WORK
 * ----------------------------------------------------------------------------
 * "Here are the seven that actually fit you", rather than "here are five
 * thousand jobs".
 *
 * The views are slices of one ranked list, not separate queries. That is why a
 * job cannot appear at 91% under Gigs and 84% under For You: there is one
 * score, computed once, and the tabs only decide which rows are shown.
 *
 * The default is For You and it is not a personalisation gimmick — a student
 * with no work profile still gets a defensible ordering, because every
 * component of the score falls back to neutral rather than to zero when it has
 * nothing to go on. The empty profile costs them accuracy, not results.
 * ============================================================================
 */
export default async function WorkPage(props: PageProps<"/work">) {
  const viewer = await requireViewer();
  const now = requestDate();
  const params = await props.searchParams;

  const pick = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const raw = pick("view");
  const view: WorkView = workViews.includes(raw as WorkView) ? (raw as WorkView) : "for-you";

  const feed = await loadWorkFeed({
    userId: viewer.user.id,
    citySlug: viewer.profile.citySlug,
    campusSlug: viewer.profile.campusSlug,
  });

  const shown = feed.matches.filter((match) => inView(match.opportunity, view, now));

  /* Counts on the tabs so an empty view is visibly empty before it is opened,
     rather than after. */
  const counts = new Map(
    workViews.map((candidate) => [
      candidate,
      feed.matches.filter((match) => inView(match.opportunity, candidate, now)).length,
    ]),
  );

  const profileSet = feed.profile.lookingFor !== "no" || feed.profile.skills.length > 0;

  return (
    <div className="page py-6 sm:py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <MascotArt state="thinking" className="hidden size-14 shrink-0 sm:block" />
          <div className="min-w-0">
            <h1 className="text-display-xs text-ink-950 sm:text-display-sm">Work</h1>
            <p className="mt-1.5 max-w-xl text-[0.9375rem] leading-relaxed text-ink-600">
              Part-time jobs, one-off gigs and paid projects in {viewer.city.name}, ranked against
              what you can do, when you are free and what you need to earn.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/work/post"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink-950 px-4 py-2 text-[0.875rem] font-semibold text-paper transition-colors hover:bg-ink-800"
          >
            <Plus className="size-4" />
            Post a gig
          </Link>
          <Link
            href="/work/applications"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[0.875rem] font-medium text-ink-700 ring-1 ring-ink-950/8 transition-colors hover:text-ink-950"
          >
            <ClipboardList className="size-4" />
            Applications
          </Link>
          <Link
            href="/work/profile"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[0.875rem] font-medium text-ink-700 ring-1 ring-ink-950/8 transition-colors hover:text-ink-950"
          >
            <SlidersHorizontal className="size-4" />
            {profileSet ? "Your work profile" : "Set up matching"}
          </Link>
        </div>
      </header>

      {!profileSet ? (
        <p className="mt-5 rounded-2xl bg-signal-soft px-4 py-3 text-[0.875rem] leading-relaxed text-ink-800">
          These are ranked on very little so far — you have not said what you can do or when you are
          free. Two minutes on{" "}
          <Link href="/work/profile" className="font-semibold underline">
            your work profile
          </Link>{" "}
          changes the order properly.
        </p>
      ) : null}

      <EarnPanel
        matches={feed.matches}
        profile={feed.profile}
        entitlements={viewer.entitlements}
        where={viewer.currency}
      />

      <nav aria-label="Work views" className="mt-6 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1.5">
          {workViews.map((candidate) => {
            const active = candidate === view;
            const count = counts.get(candidate) ?? 0;
            return (
              <li key={candidate}>
                <Link
                  href={candidate === "for-you" ? "/work" : `/work?view=${candidate}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.875rem] font-medium transition-colors",
                    active
                      ? "bg-ink-950 text-paper"
                      : "bg-white text-ink-600 ring-1 ring-ink-950/8 hover:text-ink-950",
                  )}
                >
                  {workViewLabel[candidate]}
                  <span className={cn("tnum font-mono text-[0.75rem]", active ? "text-paper/60" : "text-ink-400")}>
                    {count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {shown.length > 0 ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {shown.map((match) => (
            <WorkCard
              key={match.opportunity.id}
              match={match}
              where={viewer.currency}
              whenLabel={
                match.opportunity.startsAt
                  ? fmtWhen(match.opportunity.startsAt, viewer.city.timezone, now)
                  : null
              }
              saved={feed.saved.has(match.opportunity.id)}
              statusLabel={statusLabelFor(feed, match.opportunity.id)}
            />
          ))}
        </ul>
      ) : (
        <div className="mt-5">
          <Empty
            line={
              view === "for-you"
                ? "Nothing on the board in your city yet. No employer feed is connected and nobody here has posted paid work — you can be the first."
                : `Nothing under ${workViewLabel[view].toLowerCase()} right now. Nothing is being hidden from you; there is genuinely nothing that matches.`
            }
            action="Post a gig"
            href="/work/post"
          />
        </div>
      )}

      <section className="mt-8 rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
        <h2 className="inline-flex items-center gap-2 text-[0.9375rem] font-semibold text-ink-950">
          <ShieldCheck className="size-4 text-signal-deep" />
          Before you take any of it
        </h2>
        <ul className="mt-2.5 space-y-1.5 text-[0.875rem] leading-relaxed text-ink-600">
          {workSafety.map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-ink-300" />
              {line}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-500">
          How many hours you are allowed to work depends on your nationality and your permit.
          StudentOS does not work that out —{" "}
          <Link href="/work/rights" className="font-medium text-flow hover:underline">
            here is the official source for {viewer.city.country}
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

function statusLabelFor(
  feed: Awaited<ReturnType<typeof loadWorkFeed>>,
  opportunityId: string,
): string | null {
  const application = feed.applications.get(opportunityId);
  /* "Saved" is already shown by the bookmark, so repeating it as a status
     chip would be the same fact twice on one card. */
  if (!application || application.status === "saved") return null;
  return application.status === "rejected"
    ? "Closed"
    : application.status[0].toUpperCase() + application.status.slice(1);
}
