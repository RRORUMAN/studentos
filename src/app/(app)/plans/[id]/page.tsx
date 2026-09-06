import { ArrowLeft, MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AnyoneDownButton } from "@/components/app/anyone-down-button";
import { PlanOwnerControls, PlanRespond, PlanVote, RemoveLineButton } from "@/components/app/plan-controls";
import { Upsell } from "@/components/app/upsell";
import { MascotArt } from "@/components/mascot/mascot-art";
import { Badge } from "@/components/ui/primitives";
import { recordUpgradeTrigger } from "@/server/actions/upgrade";
import { findMany } from "@/server/db";
import { loadPlan } from "@/server/queries/plans";
import { loadFriendIds } from "@/server/queries/social";
import { requireViewer } from "@/server/viewer";
import { cn, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Plan",
  robots: { index: false, follow: false },
};

/**
 * One plan: the lines, the people, the votes, and the way to share it.
 *
 * Voting is free for the owner and anyone who joined. Inviting a second person
 * is where Pro's group planner earns its place — shared budgets, the split and
 * a plan the group can edit — and that is offered in context, once, rather
 * than as a padlock on the invite button.
 */
export default async function PlanPage(props: PageProps<"/plans/[id]">) {
  const viewer = await requireViewer();
  const { id } = await props.params;

  const data = await loadPlan(id, viewer.user.id);
  if (!data) notFound();

  const { plan, mine, member, members, votes, myVotes, owner } = data;
  const where = viewer.currency;
  const social = !viewer.profile.socialGoals.includes("private");

  const [friendIds, profiles, chat] = await Promise.all([
    loadFriendIds(viewer.user.id),
    findMany("profiles", (row) => row.userId !== viewer.user.id),
    findMany("chat", (row) => row.channel === `plan-${id}`),
  ]);

  const friends = profiles
    .filter((profile) => friendIds.has(profile.userId))
    .map((profile) => ({ userId: profile.userId, displayName: profile.displayName, avatarEmoji: profile.avatarEmoji }));

  const inMembers = members.filter((row) => row.status === "in");
  const invitedMembers = members.filter((row) => row.status === "invited");
  const canVote = mine || member?.status === "in";
  const total = plan.items.reduce((sum, item) => sum + item.priceCents, 0);
  const people = 1 + inMembers.length;

  if (mine && members.length >= 1 && !viewer.entitlements.can.groupPlanner) {
    await recordUpgradeTrigger("group-plan");
  }

  const scoreFor = (index: number) => votes.filter((vote) => vote.itemIndex === index).reduce((sum, vote) => sum + vote.value, 0);
  const mineFor = (index: number) => (myVotes.find((vote) => vote.itemIndex === index)?.value ?? null) as 1 | -1 | null;

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link href="/plans" className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950">
        <ArrowLeft className="size-4" />
        Plans
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          {plan.shared ? <Badge accent="mint">Public link</Badge> : <Badge accent="flow" tone="outline">Private</Badge>}
          {plan.forDate ? (
            <span className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
              {new Date(plan.forDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </span>
          ) : null}
        </div>
        <h1 className="mt-2 text-display-xs text-ink-950 sm:text-display-sm">{plan.title}</h1>
        {plan.query ? <p className="mt-1 text-[0.875rem] text-ink-500">From &ldquo;{plan.query}&rdquo;</p> : null}
        {!mine && owner ? <p className="mt-1 text-[0.875rem] text-ink-500">By {owner.avatarEmoji} {owner.displayName}</p> : null}
      </header>

      {/* ---- numbers -------------------------------------------------------- */}
      <dl className="mt-5 grid grid-cols-3 gap-3">
        <Figure label="Estimated total" value={total === 0 ? "Free" : money(total / 100, where)} />
        <Figure label="Per person" value={total === 0 ? "Free" : money(Math.ceil(total / people) / 100, where)} />
        <Figure label="People" value={String(people)} />
      </dl>
      {plan.budgetCents !== null ? (
        <p className={cn("mt-2 text-[0.8125rem]", total > plan.budgetCents ? "text-pulse-deep" : "text-mint-deep")}>
          {total > plan.budgetCents
            ? `${money((total - plan.budgetCents) / 100, where)} over the ${money(plan.budgetCents / 100, where)} budget.`
            : `Inside the ${money(plan.budgetCents / 100, where)} budget with ${money((plan.budgetCents - total) / 100, where)} to spare.`}
        </p>
      ) : null}

      {/* ---- lines ---------------------------------------------------------- */}
      <section className="mt-5 overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
        {plan.items.length === 0 ? (
          <div className="flex items-center gap-4 p-5">
            <MascotArt state="thinking" className="size-11 shrink-0" />
            <p className="text-[0.9375rem] text-ink-600">
              Empty so far. Add places and events from Discover with &ldquo;Add to plan&rdquo;, or{" "}
              <Link href="/ask?q=Plan%20Saturday" className="font-medium text-ink-900 underline underline-offset-4">ask for one</Link>.
            </p>
          </div>
        ) : (
          <ol className="divide-y divide-ink-100">
            {plan.items.map((item, index) => {
              const href = item.refKind === "place" ? `/discover/${item.refId}` : item.refKind === "event" ? `/events/${item.refId}` : null;
              return (
                <li key={`${item.title}-${index}`} className="flex items-start gap-3 px-5 py-3.5">
                  <span className="tnum w-6 shrink-0 pt-0.5 font-mono text-[0.75rem] text-ink-400">{item.time || index + 1}</span>
                  <div className="min-w-0 flex-1">
                    {href ? (
                      <Link href={href} className="text-[0.9375rem] font-medium text-ink-900 hover:underline">{item.title}</Link>
                    ) : (
                      <p className="text-[0.9375rem] font-medium text-ink-900">{item.title}</p>
                    )}
                    {item.detail ? <p className="mt-0.5 text-[0.8125rem] text-ink-500">{item.detail}{item.walkMinutes ? ` · ${item.walkMinutes} min walk` : ""}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <PlanVote planId={plan.id} index={index} score={scoreFor(index)} mine={mineFor(index)} canVote={Boolean(canVote)} />
                    <span className={cn("tnum font-mono text-[0.9375rem] font-medium", item.priceCents === 0 ? "text-mint-deep" : "text-ink-900")}>
                      {item.priceCents === 0 ? "Free" : money(item.priceCents / 100, where)}
                    </span>
                    {mine ? <RemoveLineButton planId={plan.id} index={index} /> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* ---- people --------------------------------------------------------- */}
      {members.length > 0 ? (
        <section className="mt-5">
          <h2 className="mb-2 text-[1.0625rem] font-semibold text-ink-950">Who is in</h2>
          <ul className="flex flex-wrap gap-2">
            {inMembers.map((row) => (
              <li key={row.userId} className="inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-3 py-1.5 text-[0.8125rem] font-medium text-mint-deep">
                <span aria-hidden>{row.avatarEmoji}</span>{row.displayName}
              </li>
            ))}
            {invitedMembers.map((row) => (
              <li key={row.userId} className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 px-3 py-1.5 text-[0.8125rem] font-medium text-ink-600">
                <span aria-hidden>{row.avatarEmoji}</span>{row.displayName} · invited
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- controls ------------------------------------------------------- */}
      <div className="mt-6 space-y-4">
        {mine ? (
          <PlanOwnerControls planId={plan.id} title={plan.title} shared={plan.shared} friends={friends} invited={new Set(members.map((row) => row.userId))} />
        ) : (
          <PlanRespond planId={plan.id} status={member?.status ?? null} />
        )}

        {(mine || member?.status === "in") && people >= 2 ? (
          <Link href={`/pulse/chat/plan-${plan.id}`} className="flex items-center gap-4 rounded-2xl bg-ink-950 p-4 text-paper hover:bg-ink-800">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-paper/10"><MessagesSquare className="size-4.5 text-signal" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-semibold">Plan chat</span>
              <span className="mt-0.5 block text-[0.8125rem] text-paper/70">{chat.length === 0 ? "Where to meet, what time, who is bringing what." : `${chat.length} messages`}</span>
            </span>
          </Link>
        ) : null}

        {social && mine ? (
          <AnyoneDownButton anchorKind="plan" anchorId={plan.id} title={plan.title} startsAt={plan.forDate ?? undefined} />
        ) : null}

        {mine && !viewer.entitlements.can.groupPlanner && members.length >= 1 ? (
          <Upsell
            feature="groupPlanner"
            line="Once two or more people are in, Pro splits the cost automatically, keeps a shared budget for the night, and lets everyone edit the same plan."
          />
        ) : null}
      </div>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-3.5 ring-1 ring-ink-950/6">
      <dt className="font-mono text-micro uppercase tracking-[0.08em] text-ink-400">{label}</dt>
      <dd className="tnum mt-1 font-mono text-[1.125rem] font-semibold text-ink-950">{value}</dd>
    </div>
  );
}
