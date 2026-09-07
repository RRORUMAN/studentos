import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { MascotArt } from "@/components/mascot/mascot-art";
import { TaskList, type TaskView } from "@/components/app/task-list";
import { leavingTasks } from "@/config/arrival-plan";
import { findMany } from "@/server/db";
import { requireViewer } from "@/server/viewer";
import { money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Leaving",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * LEAVING MODE
 * ----------------------------------------------------------------------------
 * The other end of the lifecycle, and the loop that feeds the start of it.
 *
 * Most products treat departure as churn and show nothing. That is a mistake on
 * both sides: the leaving student has a genuinely stressful fortnight of
 * cancellations and deposits, and the arriving student needs exactly the flat
 * full of things the leaving one is about to throw away.
 *
 * So Leaving Mode is a checklist *and* a supply of marketplace listings, and
 * the two are the same feature.
 * ============================================================================
 */
export default async function LeavingPage() {
  const viewer = await requireViewer();
  const where = viewer.currency;

  const [done, recurring, listings] = await Promise.all([
    findMany("arrival", (row) => row.userId === viewer.user.id),
    findMany("recurring", (row) => row.userId === viewer.user.id && row.active),
    findMany("listings", (row) => row.sellerId === viewer.user.id && row.status === "active"),
  ]);

  const doneIds = new Set(done.map((row) => row.taskId));
  const social = !viewer.profile.socialGoals.includes("private");

  const tasks: TaskView[] = leavingTasks
    .filter((task) => (task.social ? social : true))
    .map((task) => ({
      id: task.id,
      label: task.label,
      detail: task.detail,
      effort: task.effort,
      href: task.href,
      official: task.official,
      unblocksCount: 0,
      done: doneIds.has(task.id),
      source: null,
    }));

  const days = viewer.stage.daysUntilDeparture;

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <header className="flex items-start gap-4">
        <MascotArt state="survival" className="size-16 shrink-0" />
        <div>
          <h1 className="text-display-xs text-ink-950 sm:text-display-sm">
            Leaving {viewer.city.name}
          </h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-600">
            {days !== null && days >= 0
              ? `${days} days. The cancellations are the part people forget until a charge lands two months later.`
              : "The cancellations are the part people forget until a charge lands two months later."}
          </p>
        </div>
      </header>

      {/* ---- what is still charging you ------------------------------------ */}
      {recurring.length > 0 ? (
        <section className="mt-7 rounded-xl border border-pulse-deep/20 bg-pulse-soft/40 p-5">
          <h2 className="text-[1.0625rem] font-semibold text-ink-950">
            Still set to charge you
          </h2>
          <ul className="mt-3 space-y-2">
            {recurring.map((expense) => (
              <li
                key={expense.id}
                className="flex items-center justify-between gap-3 text-[0.9375rem]"
              >
                <span className="text-ink-800">{expense.label}</span>
                <span className="tnum shrink-0 font-mono font-medium text-ink-900">
                  {money(expense.amountCents / 100, where)}/{expense.cadence.slice(0, 2)}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/budget"
            className="mt-3 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-pulse-deep underline underline-offset-4"
          >
            Deal with these
            <ArrowRight className="size-3.5" />
          </Link>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-3 text-[1.0625rem] font-semibold text-ink-950">Before you go</h2>
        <TaskList tasks={tasks} />
      </section>

      {/* ---- the loop into arrival ----------------------------------------- */}
      <section className="mt-6 rounded-xl border border-ink-200 bg-white p-5">
        <h2 className="text-[1.0625rem] font-semibold text-ink-950">
          Sell what you cannot take
        </h2>
        <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-600">
          Students arriving next term need a desk, a kettle and a bike. You have all three and no
          way to take them home.
        </p>

        {listings.length > 0 ? (
          <p className="tnum mt-3 font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
            {listings.length} listed
          </p>
        ) : null}

        <Link
          href="/exchange/new?mode=offer"
          className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-ink-950 px-4 py-2 text-[0.875rem] font-medium text-paper hover:bg-ink-800"
        >
          List something
          <ArrowRight className="size-3.5" />
        </Link>
      </section>
    </div>
  );
}
