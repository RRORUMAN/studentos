import type { Metadata } from "next";
import Link from "next/link";

import { AnyoneDownButton } from "@/components/app/anyone-down-button";
import { Empty } from "@/components/app/cards";
import { MascotArt } from "@/components/mascot/mascot-art";
import { findMany } from "@/server/db";
import { canSeeInvite } from "@/server/queries/social";
import { requestNow } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { brand } from "@/brand/brand.config";
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
  const where = viewer.currency;

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
          {visible.map((invite) => {
            const going = goingCount(invite.id);
            const host = byUser.get(invite.hostId);
            const full = going >= invite.capacity;

            return (
              <li key={invite.id}>
                <Link
                  href={`/anyone-down/${invite.id}`}
                  className="block rounded-lg border border-ink-200 bg-white p-4 transition-colors hover:border-ink-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[1.0625rem] font-semibold text-ink-950">{invite.title}</p>
                      <p className="mt-1 text-[0.8125rem] text-ink-500">
                        {new Date(invite.startsAt).toLocaleString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {host ? ` · ${host.avatarEmoji} ${host.displayName}` : ""}
                        {invite.budgetCents
                          ? ` · ~${money(invite.budgetCents / 100, where)} each`
                          : ""}
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
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
