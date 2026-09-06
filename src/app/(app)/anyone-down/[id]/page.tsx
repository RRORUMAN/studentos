import { ArrowLeft, Clock, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JoinControls } from "@/components/app/anyone-down-button";
import { GroupChat } from "@/components/app/group-chat";
import { marketplaceSafety } from "@/domain/social";
import { findMany, findOne } from "@/server/db";
import { requestNow } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Plan",
  robots: { index: false, follow: false },
};

/**
 * One plan, its people, and the group chat that appears once anyone joins.
 *
 * The chat is gated on having at least two people rather than on tier: a chat
 * with one person in it is not a feature, and showing an empty one makes the
 * plan feel dead before anyone has had a chance to see it.
 */
export default async function InvitePage(props: PageProps<"/anyone-down/[id]">) {
  const viewer = await requireViewer();
  const { id } = await props.params;

  const invite = await findOne("invites", (row) => row.id === id);
  if (!invite) notFound();

  const [responses, profiles, chat] = await Promise.all([
    findMany("inviteResponses", (row) => row.inviteId === id),
    findMany("profiles", () => true),
    findMany("chat", (row) => row.channel === `invite-${id}`),
  ]);

  const byUser = new Map(profiles.map((profile) => [profile.userId, profile]));
  const going = responses.filter((row) => row.status === "in");
  const maybe = responses.filter((row) => row.status === "maybe");
  const mine = responses.find((row) => row.userId === viewer.user.id);
  const host = byUser.get(invite.hostId);
  const closed = Date.parse(invite.closesAt) < requestNow();
  const where = viewer.currency;

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link
        href="/anyone-down"
        className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950"
      >
        <ArrowLeft className="size-4" />
        All plans
      </Link>

      <h1 className="text-display-xs text-ink-950 sm:text-display-sm">{invite.title}</h1>

      {invite.detail ? (
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-700">{invite.detail}</p>
      ) : null}

      <dl className="mt-5 space-y-2">
        <div className="flex items-center gap-3 text-[0.9375rem] text-ink-800">
          <Clock className="size-4 shrink-0 text-ink-400" />
          <dd>
            {new Date(invite.startsAt).toLocaleString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </dd>
        </div>
        <div className="flex items-center gap-3 text-[0.9375rem] text-ink-800">
          <Users className="size-4 shrink-0 text-ink-400" />
          <dd>
            {going.length} of {invite.capacity} in
            {maybe.length > 0 ? `, ${maybe.length} maybe` : ""}
            {invite.budgetCents ? ` · ~${money(invite.budgetCents / 100, where)} each` : ""}
          </dd>
        </div>
      </dl>

      {host ? (
        <p className="mt-3 text-[0.8125rem] text-ink-500">
          Hosted by {host.avatarEmoji} {host.displayName}
        </p>
      ) : null}

      {/* ---- people -------------------------------------------------------
          First names and avatars only. No location, no contact details — the
          group chat is the introduction. */}
      {going.length > 0 ? (
        <ul className="mt-5 flex flex-wrap gap-2">
          {going.map((response) => {
            const profile = byUser.get(response.userId);
            return (
              <li
                key={response.userId}
                className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 px-3 py-1.5 text-[0.8125rem] font-medium text-ink-700"
              >
                <span aria-hidden>{profile?.avatarEmoji ?? "🙂"}</span>
                {profile?.displayName ?? "Someone"}
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="mt-6">
        {closed ? (
          <p className="rounded-lg bg-ink-100 px-4 py-3 text-[0.875rem] text-ink-600">
            This one has closed.
          </p>
        ) : (
          <JoinControls
            inviteId={invite.id}
            status={mine?.status ?? null}
            full={going.length >= invite.capacity}
          />
        )}
      </div>

      {going.length >= 2 && mine?.status === "in" ? (
        <div className="mt-8">
          <h2 className="mb-3 text-[1.0625rem] font-semibold text-ink-950">Group chat</h2>
          <GroupChat
            channel={`invite-${invite.id}`}
            lines={chat
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
              .map((message) => ({
                id: message.id,
                body: message.body,
                createdAt: message.createdAt,
                author: byUser.get(message.authorId)
                  ? {
                      displayName: byUser.get(message.authorId)!.displayName,
                      avatarEmoji: byUser.get(message.authorId)!.avatarEmoji,
                    }
                  : null,
                mine: message.authorId === viewer.user.id,
              }))}
          />
        </div>
      ) : null}

      <section className="mt-8 rounded-lg border border-ink-200 bg-paper-2/60 p-4">
        <h2 className="mb-2 font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
          Meeting people you do not know
        </h2>
        <ul className="space-y-1.5">
          {marketplaceSafety.slice(0, 3).map((line) => (
            <li key={line} className="flex gap-2 text-[0.8125rem] leading-snug text-ink-600">
              <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-ink-400" />
              {line}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
