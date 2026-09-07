import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Empty } from "@/components/app/cards";
import { StatusPicker } from "@/components/app/work-actions";
import { Badge } from "@/components/ui/primitives";
import {
  type ApplicationStatus,
  applicationStatusMeta,
  applicationStatuses,
  payPeriodLabel,
  workKindMeta,
} from "@/domain/work";
import { loadApplications, loadOpportunity } from "@/server/queries/work";
import { requireViewer } from "@/server/viewer";
import { minutesSince } from "@/server/now";
import { ago, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Your applications",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * THE TRACKER
 * ----------------------------------------------------------------------------
 * Five columns' worth of information in one list, because a student with six
 * applications does not need a kanban board and a student with sixty is not
 * going to drag cards on a phone.
 *
 * Every row is a posting that still exists. A job the source took down is
 * shown as gone rather than removed: it is part of the student's own record of
 * what they did with their week, and deleting it would quietly rewrite that.
 * ============================================================================
 */
export default async function ApplicationsPage() {
  const viewer = await requireViewer();
  const applications = await loadApplications(viewer.user.id);

  const rows = await Promise.all(
    applications.map(async (application) => ({
      application,
      opportunity: await loadOpportunity(application.opportunityId),
    })),
  );

  const open = rows.filter((row) => applicationStatusMeta[row.application.status].open);
  const closed = rows.filter((row) => !applicationStatusMeta[row.application.status].open);

  const counts = new Map<ApplicationStatus, number>(
    applicationStatuses.map((status) => [
      status,
      rows.filter((row) => row.application.status === status).length,
    ]),
  );

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link
        href="/work"
        className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950"
      >
        <ArrowLeft className="size-4" />
        Work
      </Link>

      <h1 className="text-display-xs text-ink-950 sm:text-display-sm">Your applications</h1>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">
        Nothing here moves on its own. StudentOS never marks a job applied because you opened it —
        every status on this page is one you set.
      </p>

      {rows.length > 0 ? (
        <p className="mt-4 flex flex-wrap gap-2 text-[0.8125rem] text-ink-500">
          {applicationStatuses
            .filter((status) => (counts.get(status) ?? 0) > 0)
            .map((status) => (
              <span key={status} className="rounded-full bg-white px-2.5 py-1 ring-1 ring-ink-950/8">
                {applicationStatusMeta[status].label}{" "}
                <span className="tnum font-mono font-semibold text-ink-950">
                  {counts.get(status)}
                </span>
              </span>
            ))}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="mt-6">
          <Empty
            line="Nothing tracked yet. Save a job or tap “I applied” on one and it turns up here."
            action="Browse work"
            href="/work"
          />
        </div>
      ) : null}

      {open.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {open.map((row) => (
            <Row key={row.application.id} row={row} where={viewer.currency} />
          ))}
        </ul>
      ) : null}

      {closed.length > 0 ? (
        <>
          <h2 className="mt-8 text-[0.9375rem] font-semibold text-ink-950">Closed and archived</h2>
          <ul className="mt-3 space-y-3 opacity-70">
            {closed.map((row) => (
              <Row key={row.application.id} row={row} where={viewer.currency} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function Row({
  row,
  where,
}: {
  row: {
    application: Awaited<ReturnType<typeof loadApplications>>[number];
    opportunity: Awaited<ReturnType<typeof loadOpportunity>>;
  };
  where: { currency: string; locale: string };
}) {
  const { application, opportunity } = row;

  return (
    <li className="rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {opportunity ? (
            <>
              <Link
                href={`/work/${opportunity.id}`}
                className="text-[0.9375rem] font-semibold text-ink-950 hover:underline"
              >
                {opportunity.title}
              </Link>
              <p className="mt-0.5 text-[0.8125rem] text-ink-500">
                {opportunity.employerName ?? "Posted by a student"} ·{" "}
                {workKindMeta[opportunity.kind].label}
                {opportunity.pay
                  ? ` · ${money(opportunity.pay.minCents / 100, where)} ${payPeriodLabel[opportunity.pay.period]}`
                  : " · Pay not stated"}
              </p>
            </>
          ) : (
            /* The posting is gone, and saying so is more useful than removing
               the row from the student's own record of their week. */
            <>
              <p className="text-[0.9375rem] font-semibold text-ink-500">
                This posting is no longer listed
              </p>
              <p className="mt-0.5 text-[0.8125rem] text-ink-400">
                The source took it down. Your record of applying to it stays here.
              </p>
            </>
          )}
        </div>

        <div className="shrink-0 text-right">
          <Badge accent="flow" tone="soft">
            {applicationStatusMeta[application.status].label}
          </Badge>
          {application.appliedAt ? (
            <p className="mt-1 text-[0.75rem] text-ink-400">
              Applied {ago(minutesSince(application.appliedAt))} ago
            </p>
          ) : null}
        </div>
      </div>

      {application.note ? (
        <p className="mt-2.5 rounded-lg bg-paper-2 px-3 py-2 text-[0.8125rem] leading-relaxed text-ink-600">
          {application.note}
        </p>
      ) : null}

      <div className="mt-3">
        <StatusPicker opportunityId={application.opportunityId} status={application.status} />
      </div>
    </li>
  );
}
