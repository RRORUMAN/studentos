import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AnyoneDownButton } from "@/components/app/anyone-down-button";
import { Empty } from "@/components/app/cards";
import { MascotArt } from "@/components/mascot/mascot-art";
import { findMany } from "@/server/db";
import { canSeeInvite, resolveInviteAnchor } from "@/server/queries/social";
import { whereFor } from "@/server/queries/loop";
import { requestDate, requestNow } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { brand } from "@/brand/brand.config";
import { fmtWhen } from "@/lib/dates";
import { money } from "@/lib/utils";

export const metadata: Metadata = {
  title: brand.surfaces.anyoneDown,
  robots: { index: false, follow: false },
};

/**
 * Open plans in the city.
 *
 * Audience filtering happens server-side: a friends-only plan is never sent to
 * a browser that should not see it. Filtering in the client would put the
 * whole city's private plans in a network response.
 */
export default async function AnyoneDownPage() {
  const viewer = await requireViewer();
  const now = requestNow();
  const today = requestDate();
  const where = whereFor(viewer.profile.citySlug, viewer.profile);

  const [invites, responses, profiles] = await Promise.all([
    findMany(
      "invites",
      (row) => row.citySlug === viewer.profile.citySlug && Date.parse(row.closesAt) > now,
    ),
    findMany("inviteResponses", () => true),
    findMany("profiles", () => true),
  ]);

  const byUser = new Map(profiles.map((profile) => [profile.userId, profile]));

  /* The same predicate the join action enforces. Filtering here and checking
     there with two different rules is how a private plan leaks. */
  const allowed = await Promise.all(
    invites.map((invite) => canSeeInvite(viewer.user.id, invite)),
  );

  const visible = invites
    .filter((_, index) => allowed[index])
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const anchors = await Promise.all(visible.map((invite) => resolveInviteAnchor(invite, where, today)));

  const goingCount = (inviteId: string) =>
    responses.filter((row) => row.inviteId === inviteId && row.status === "in").length;

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <header className="mb-6 flex items-start gap-4">
        <MascotArt state="social" className="size-14 shrink-0" />
        <div>
          <h1 className="text-display-xs text-ink-950 sm:text-display-sm">
            {brand.surfaces.anyoneDown}
          </h1>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">
            Turn anything into a group. Joining is free, always — the whole thing only works if
            everyone can say yes.
          </p>
        </div>
      </header>

      <div className="mb-6">
        <AnyoneDownButton />
      </div>

      {visible.length === 0 ? (
        <Empty line="Nothing open in your city right now. Being the one who posts is the fastest way in." />
      ) : (
        <ul className="space-y-3">
          {visible.map((invite, index) => {
            const going = goingCount(invite.id);
            const host = byUser.get(invite.hostId);
            const full = going >= invite.capacity;
            const anchor = anchors[index];
            const mine = responses.find((row) => row.inviteId === invite.id && row.userId === viewer.user.id);

            return (
              <li key={invite.id}>
                <div className="relative rounded-2xl bg-white p-4 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-[1.0625rem] font-semibold text-ink-950">
                        <Link href={`/anyone-down/${invite.id}`} className="after:absolute after:inset-0 after:rounded-2xl">
                          {invite.title}
                        </Link>
                      </h2>
                      <p className="mt-1 text-[0.8125rem] text-ink-500">
                        {fmtWhen(invite.startsAt, where.timeZone, today)}
                        {host ? ` · ${host.avatarEmoji} ${host.displayName}` : ""}
                        {invite.budgetCents ? ` · ${money(invite.budgetCents / 100, where)} each` : ""}
                      </p>
                    </div>

                    <span
                      className={
                        full
                          ? "shrink-0 rounded-full bg-ink-100 px-2.5 py-1 text-[0.75rem] font-semibold text-ink-500"
                          : "shrink-0 rounded-full bg-signal-soft px-2.5 py-1 text-[0.75rem] font-semibold text-signal-deep"
                      }
                    >
                      {full ? "Full" : `${invite.capacity - going} spots`}
                    </span>
                  </div>

                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-ink-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-3.5" />
                      <span className="tnum">{going}</span> in
                    </span>
                    {mine?.status === "in" ? (
                      <span className="rounded-full bg-mint-soft px-2 py-0.5 text-[0.75rem] font-medium text-mint-deep">
                        You are in
                      </span>
                    ) : null}
                    {invite.audience !== "city" ? (
                      <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[0.75rem] font-medium text-ink-600 capitalize">
                        {invite.audience}
                      </span>
                    ) : null}
                  </p>

                  {anchor ? (
                    <p className="relative z-10 mt-2 truncate text-[0.8125rem] text-ink-600">
                      <span className="text-ink-400">At </span>
                      <Link href={anchor.href} className="font-medium underline underline-offset-4 hover:text-ink-950">
                        {anchor.title}
                      </Link>
                      <span className="text-ink-400"> · {anchor.meta}</span>
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
