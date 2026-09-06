import { ArrowLeft, Clock, ExternalLink, MapPin, MessagesSquare, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AnyoneDownButton } from "@/components/app/anyone-down-button";
import { AddToPlanButton, EventResponseButtons } from "@/components/app/event-actions";
import { FeedbackMenu } from "@/components/app/feedback-menu";
import { SaveButton } from "@/components/app/save-button";
import { ShareButton } from "@/components/app/share-button";
import { MascotArt } from "@/components/mascot/mascot-art";
import { Badge } from "@/components/ui/primitives";
import { loadCityEvents } from "@/server/queries/discovery";
import { loadEventEnergy } from "@/server/queries/events";
import { findMany, findOne } from "@/server/db";
import { requestDate } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Event",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * EVENT
 * ----------------------------------------------------------------------------
 * One event, its energy, and the way in.
 *
 * The chat appears once the student has said Interested or Going. It is the
 * "who is going / where are we meeting / anyone coming alone" room, and it
 * closes with the event.
 * ============================================================================
 */
export default async function EventPage(props: PageProps<"/events/[id]">) {
  const viewer = await requireViewer();
  const { id } = await props.params;
  const now = requestDate();

  const events = await loadCityEvents(viewer.profile.citySlug);
  const event = events.find((entry) => entry.id === id);
  if (!event) notFound();

  const where = viewer.currency;
  const social = !viewer.profile.socialGoals.includes("private");

  const [saved, energyMap, chat, discussion] = await Promise.all([
    findOne("saved", (row) => row.userId === viewer.user.id && row.kind === "event" && row.targetId === id),
    loadEventEnergy({ viewerId: viewer.user.id, campusSlug: viewer.profile.campusSlug, eventIds: [id] }),
    findMany("chat", (row) => row.channel === `event-${id}`),
    findMany("posts", (row) => row.placeId === id && row.hiddenAt === null),
  ]);

  const energy = energyMap.get(id)!;
  const starts = new Date(event.startsAt);
  const past = Date.parse(event.endsAt ?? event.startsAt) + 2 * 3_600_000 < now.getTime();
  const inChat = energy.mine !== null;

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <Link
        href="/events"
        className="mb-6 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-500 hover:text-ink-950"
      >
        <ArrowLeft className="size-4" />
        Event radar
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          {event.priceCents === 0 ? (
            <Badge accent="mint" tone="solid">Free</Badge>
          ) : (
            <span className="tnum font-mono text-[1.125rem] font-semibold text-ink-900">
              {money(event.priceCents / 100, where)}
            </span>
          )}
          <span className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
            {event.kind}
          </span>
          {past ? <Badge accent="amber">Finished</Badge> : null}
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h1 className="text-display-xs text-ink-950 sm:text-display-sm">{event.title}</h1>
          <FeedbackMenu targetKind="event" targetId={event.id} className="mt-1 shrink-0" />
        </div>
      </header>

      <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-700">{event.blurb}</p>

      <dl className="mt-5 space-y-2.5">
        <Row icon={<Clock className="size-4" />} label="When">
          {starts.toLocaleString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Row>
        <Row icon={<MapPin className="size-4" />} label="Where">
          {event.venue}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue}, ${viewer.city.name}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-ink-600 underline underline-offset-4 hover:text-ink-950"
          >
            Directions
            <ExternalLink className="size-3" />
          </a>
        </Row>
      </dl>

      {/* ---- energy -------------------------------------------------------- */}
      <section className="mt-6 rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
        <h2 className="flex items-center gap-2 text-[1.0625rem] font-semibold text-ink-950">
          <Users className="size-4.5 text-ink-400" />
          Who is around
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat value={event.interested + energy.interested} label="interested" />
          <Stat value={energy.going} label="going" />
          {viewer.profile.campusSlug ? (
            <Stat value={energy.fromCampus} label={`from ${viewer.campusName ?? "campus"}`} accent />
          ) : null}
          <Stat value={energy.lookingForCompany} label="looking for people" />
        </ul>

        {energy.friends.length > 0 ? (
          <p className="mt-4 flex flex-wrap items-center gap-2 text-[0.9375rem] text-ink-800">
            {energy.friends.map((friend) => (
              <span
                key={friend.userId}
                className="inline-flex items-center gap-1.5 rounded-full bg-pulse-soft px-3 py-1 text-[0.8125rem] font-medium text-pulse-deep"
              >
                <span aria-hidden>{friend.avatarEmoji}</span>
                {friend.displayName} · {friend.status}
              </span>
            ))}
          </p>
        ) : null}

        {!past ? (
          <div className="mt-5">
            <EventResponseButtons
              eventId={event.id}
              status={energy.mine}
              goingCount={energy.going}
              interestedCount={event.interested + energy.interested}
            />
          </div>
        ) : null}
      </section>

      {/* ---- actions ------------------------------------------------------ */}
      <div className="mt-4 flex flex-wrap gap-2">
        <SaveButton kind="event" targetId={event.id} saved={Boolean(saved)} />
        <ShareButton path={`/events/${event.id}`} title={event.title} />
        <AddToPlanButton refKind="event" refId={event.id} />
      </div>

      {/* ---- chat ---------------------------------------------------------- */}
      {social && !past ? (
        <section className="mt-6">
          {inChat ? (
            <Link
              href={`/pulse/chat/event-${event.id}`}
              className="flex items-center gap-4 rounded-2xl bg-ink-950 p-5 text-paper transition-colors hover:bg-ink-800"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-paper/10">
                <MessagesSquare className="size-5 text-signal" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[1rem] font-semibold">Event chat</span>
                <span className="mt-0.5 block text-[0.8125rem] text-paper/70">
                  {chat.length === 0
                    ? "Nobody has said anything yet. Who is going, where to meet, anyone coming alone?"
                    : `${chat.length} ${chat.length === 1 ? "message" : "messages"} · people who are going or interested`}
                </span>
              </span>
            </Link>
          ) : (
            <div className="flex items-center gap-4 rounded-2xl bg-paper-2 p-5 ring-1 ring-ink-950/6">
              <MascotArt state="social" className="size-11 shrink-0" />
              <p className="text-[0.875rem] leading-snug text-ink-600">
                Tap Interested or Going to open the event chat — who is going, where to meet, anyone
                coming alone.
              </p>
            </div>
          )}
        </section>
      ) : null}

      {/* ---- source -------------------------------------------------------- */}
      <p className="mt-6 flex flex-wrap items-center gap-2 text-[0.8125rem] text-ink-500">
        <span className="rounded-full bg-ink-100 px-2.5 py-1 font-medium text-ink-600">
          {event.source === "official"
            ? "Official source"
            : event.source === "venue"
              ? "Published by the venue"
              : "Reported by students"}
        </span>
        {event.confirmations >= 10 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-mint-soft px-2.5 py-1 font-medium text-mint-deep">
            <ShieldCheck className="size-3.5" />
            Confirmed by {event.confirmations} students
          </span>
        ) : null}
        <span>
          Checked{" "}
          {new Date(event.observedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </span>
        {event.sourceUrl ? (
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-ink-700 underline underline-offset-4 hover:text-ink-950"
          >
            Check the source
            <ExternalLink className="size-3" />
          </a>
        ) : null}
      </p>

      {social && !past ? (
        <div className="mt-7">
          <AnyoneDownButton
            anchorKind="event"
            anchorId={event.id}
            title={event.title}
            startsAt={event.startsAt}
          />
        </div>
      ) : null}

      {discussion.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-[1.0625rem] font-semibold text-ink-950">Students said</h2>
          <ul className="space-y-2">
            {discussion.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/pulse/${post.id}`}
                  className="block rounded-xl bg-white p-4 ring-1 ring-ink-950/6 hover:shadow-[var(--shadow-raise)]"
                >
                  <span className="block text-[0.9375rem] font-medium text-ink-900">{post.title}</span>
                  <span className="mt-0.5 block text-[0.8125rem] text-ink-500">
                    {post.commentCount} replies · {post.upvotes} upvotes
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-ink-400">{icon}</span>
      <dt className="sr-only">{label}</dt>
      <dd className="text-[0.9375rem] text-ink-800">{children}</dd>
    </div>
  );
}

function Stat({ value, label, accent = false }: { value: number; label: string; accent?: boolean }) {
  return (
    <li>
      <p className={accent ? "tnum font-mono text-[1.5rem] leading-none font-semibold text-flow-deep" : "tnum font-mono text-[1.5rem] leading-none font-semibold text-ink-950"}>
        {value}
      </p>
      <p className="mt-1 text-[0.8125rem] text-ink-500">{label}</p>
    </li>
  );
}
