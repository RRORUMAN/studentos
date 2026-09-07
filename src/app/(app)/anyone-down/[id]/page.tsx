import { ArrowLeft, Clock, MapPin, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CloseInviteButton, DoItAgain, JoinControls } from "@/components/app/anyone-down-button";
import { ChatView } from "@/components/app/chat-view";
import { PersonRow } from "@/components/app/people";
import { SaveButton } from "@/components/app/save-button";
import { ShareButton } from "@/components/app/share-button";
import { marketplaceSafety } from "@/domain/social";
import { findMany, findOne } from "@/server/db";
import { loadChannelLines, loadChannelParticipants } from "@/server/queries/chat";
import { loadAttachables, whereFor } from "@/server/queries/loop";
import { canSeeInvite, friendshipWith, resolveInviteAnchor, visibleProfile } from "@/server/queries/social";
import { requestDate, requestNow } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { fmtLongDay, fmtTime } from "@/lib/dates";
import { money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Plan",
  robots: { index: false, follow: false },
};

/**
 * One plan, its people, and the group chat.
 *
 * The chat is the same `ChatView` every other conversation uses, and it opens
 * the moment you are in rather than waiting for a second person: a group of
 * one that cannot say "on my way" is how a plan dies before anyone sees it.
 * Access is the channel rule — `invite-<id>` is readable by people who
 * joined — so nothing here is a UI-only restriction.
 */
export default async function InvitePage(props: PageProps<"/anyone-down/[id]">) {
  const viewer = await requireViewer();
  const { id } = await props.params;

  const invite = await findOne("invites", (row) => row.id === id);
  if (!invite) notFound();

  /* A plan you cannot see is not found, rather than forbidden: confirming a
     friends-only plan exists is itself a leak. */
  if (!(await canSeeInvite(viewer.user.id, invite))) notFound();

  const now = requestNow();
  const today = requestDate();
  const where = whereFor(invite.citySlug, viewer.profile);

  const [responses, profiles, savedRows] = await Promise.all([
    findMany("inviteResponses", (row) => row.inviteId === id),
    findMany("profiles", () => true),
    findMany("saved", (row) => row.userId === viewer.user.id),
  ]);

  const byUser = new Map(profiles.map((profile) => [profile.userId, profile]));
  const going = responses.filter((row) => row.status === "in");
  const maybe = responses.filter((row) => row.status === "maybe");
  const mine = responses.find((row) => row.userId === viewer.user.id);
  const host = byUser.get(invite.hostId);
  const isHost = invite.hostId === viewer.user.id;
  const closed = Date.parse(invite.closesAt) < now;
  const started = Date.parse(invite.startsAt) < now;
  const joined = mine?.status === "in";
  const channel = `invite-${invite.id}`;

  const anchor = await resolveInviteAnchor(invite, where, today);

  /* The chat is loaded only for people who are in it — a page that fetches a
     group's messages and then hides them client-side has already sent them. */
  const [lines, participants, attachables] = joined
    ? await Promise.all([
        loadChannelLines({ channel, userId: viewer.user.id, citySlug: invite.citySlug }),
        loadChannelParticipants({ channel, userId: viewer.user.id, citySlug: invite.citySlug }),
        loadAttachables(invite.citySlug, where),
      ])
    : [[], [], []];

  /* After it happened: the people you actually met, so adding them is one tap
     while you still remember who they were. */
  const others = going.filter((row) => row.userId !== viewer.user.id);
  const met = started && joined
    ? (
        await Promise.all(
          others.map(async (row) => {
            const profile = byUser.get(row.userId);
            if (!profile) return null;
            const visible = await visibleProfile(viewer.user.id, profile);
            if (!visible) return null;
            return { profile: visible, state: await friendshipWith(viewer.user.id, row.userId) };
          }),
        )
      ).filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    : [];

  const perPerson = invite.budgetCents;

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
        <p className="mt-2 text-[0.9375rem] leading-relaxed whitespace-pre-line text-ink-700">{invite.detail}</p>
      ) : null}

      <dl className="mt-5 space-y-2">
        <div className="flex items-center gap-3 text-[0.9375rem] text-ink-800">
          <Clock className="size-4 shrink-0 text-ink-400" />
          <dd>
            {fmtLongDay(invite.startsAt, where.timeZone)} · {fmtTime(invite.startsAt, where.timeZone)}
          </dd>
        </div>
        <div className="flex items-center gap-3 text-[0.9375rem] text-ink-800">
          <Users className="size-4 shrink-0 text-ink-400" />
          <dd>
            <span className="tnum">{going.length}</span> in · {Math.max(0, invite.capacity - going.length)} spots
            {maybe.length > 0 ? `, ${maybe.length} maybe` : ""}
          </dd>
        </div>
        {perPerson !== null ? (
          <div className="flex items-center gap-3 text-[0.9375rem] text-ink-800">
            <Wallet className="size-4 shrink-0 text-ink-400" />
            <dd>
              {money(perPerson / 100, where)} each
              {going.length > 1 ? (
                <span className="text-ink-500"> · {money((perPerson * going.length) / 100, where)} for the group</span>
              ) : null}
            </dd>
          </div>
        ) : null}
        {anchor?.venue ? (
          <div className="flex items-center gap-3 text-[0.9375rem] text-ink-800">
            <MapPin className="size-4 shrink-0 text-ink-400" />
            <dd>{anchor.venue}</dd>
          </div>
        ) : null}
      </dl>

      {/* ---- the thing it is attached to ---------------------------------- */}
      {anchor ? (
        <Link
          href={anchor.href}
          className="mt-5 flex items-center gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-ink-950/8 hover:shadow-[var(--shadow-raise)]"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-signal-soft">
            <MapPin className="size-4 text-signal-deep" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[0.9375rem] font-semibold text-ink-950">{anchor.title}</span>
            <span className="block truncate text-[0.8125rem] text-ink-500">{anchor.meta}</span>
          </span>
        </Link>
      ) : null}

      {host ? (
        <p className="mt-3 text-[0.8125rem] text-ink-500">
          Hosted by {host.avatarEmoji} {host.displayName}
          {invite.audience !== "city" ? ` · ${invite.audience} only` : ""}
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
                {response.userId === invite.hostId ? <span className="text-ink-400">host</span> : null}
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

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <ShareButton path={`/anyone-down/${invite.id}`} title={invite.title} size="sm" />
        {isHost && !closed ? <CloseInviteButton inviteId={invite.id} /> : null}
      </div>

      {/* ---- group chat ---------------------------------------------------- */}
      {joined ? (
        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="text-[1.0625rem] font-semibold text-ink-950">Group chat</h2>
            <Link
              href={`/pulse/chat/${channel}`}
              className="text-[0.8125rem] font-medium text-ink-500 underline underline-offset-4 hover:text-ink-900"
            >
              Open in Chat
            </Link>
          </div>
          <ChatView
            channel={channel}
            lines={lines}
            attachables={attachables}
            participants={participants}
            emptyLine="Nothing here yet. Say when you are leaving."
          />
        </section>
      ) : null}

      {/* ---- afterwards ---------------------------------------------------- */}
      {started && joined ? (
        <section className="mt-8">
          <h2 className="mb-3 text-[1.0625rem] font-semibold text-ink-950">Afterwards</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <DoItAgain title={invite.title} anchorKind={invite.anchorKind} anchorId={invite.anchorId} />
            {anchor && (anchor.kind === "place" || anchor.kind === "event") ? (
              <SaveButton
                kind={anchor.kind}
                targetId={anchor.id}
                saved={savedRows.some((row) => row.kind === anchor.kind && row.targetId === anchor.id)}
              />
            ) : null}
          </div>

          {met.length > 0 ? (
            <>
              <p className="mt-5 mb-2 text-[0.875rem] text-ink-600">People you turned up with:</p>
              <ul className="space-y-2">
                {met.map((entry) => (
                  <PersonRow key={entry.profile.userId} profile={entry.profile} state={entry.state} reason="You were both there" />
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

      <section className="mt-8 rounded-lg bg-paper-2/60 p-4 ring-1 ring-ink-950/5">
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
