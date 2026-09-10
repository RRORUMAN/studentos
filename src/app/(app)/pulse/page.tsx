import { MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CatchUpCard } from "@/components/app/catch-up";
import { PulseCard } from "@/components/app/pulse-card";
import { Composer, ComposerSheet } from "@/components/app/pulse-composer";
import { MascotArt } from "@/components/mascot/mascot-art";
import { BASE_SYSTEM, runAi, untrusted } from "@/server/ai/gateway";
import { catchUp } from "@/server/engines/catch-up";
import { loopChannels } from "@/server/db/seed-content";
import {
  categoryFor,
  feedViews,
  loadAttachables,
  loadFeed,
  pulseCategories,
  whereFor,
  type FeedView,
} from "@/server/queries/loop";
import { findMany } from "@/server/db";
import { requestNow } from "@/server/now";
import { isFlagOn } from "@/server/queries/settings";
import { requireViewer } from "@/server/viewer";
import { brand } from "@/brand/brand.config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: brand.surfaces.pulse,
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * STUDENT PULSE
 * ----------------------------------------------------------------------------
 * The community. Free at every tier, permanently and unmetered.
 *
 * Five views, one category model, and "Catch me up" at the top when the
 * student has been away. The catch-up is chosen by arithmetic and links to its
 * sources; the paid tier gets one model-written sentence over the same lines,
 * rendered above them and marked as a summary.
 *
 * Every city channel is two things — a feed of posts and a chat room — and
 * they now link to each other in both directions. Before this they were two
 * products that happened to share a name.
 * ============================================================================
 */
export default async function PulsePage(props: PageProps<"/pulse">) {
  const viewer = await requireViewer();
  const params = await props.searchParams;
  const now = requestNow();

  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const rawView = one("view");
  const view: FeedView = feedViews.some((entry) => entry.value === rawView) ? (rawView as FeedView) : "for-you";
  const channel = loopChannels.some((entry) => entry.slug === one("channel")) ? one("channel")! : null;
  const category = categoryFor(one("category"));

  const where = whereFor(viewer.profile.citySlug, viewer.profile);

  const [feed, allPosts, chat, attachables] = await Promise.all([
    loadFeed({
      citySlug: viewer.profile.citySlug,
      campusSlug: viewer.profile.campusSlug,
      view,
      channel,
      category: category?.value ?? null,
      userId: viewer.user.id,
    }),
    findMany("posts", (row) => row.citySlug === viewer.profile.citySlug),
    findMany("chat", (row) => row.citySlug === viewer.profile.citySlug),
    loadAttachables(viewer.profile.citySlug, where),
  ]);

  /* ---- catch me up ------------------------------------------------------
     "Since" is the student's last visit to the product, approximated by their
     last seen time, capped at a week so a returning student is not shown a
     month of history as "missed". Only shown after at least a day away. */
  const lastSeen = Date.parse(viewer.user.lastSeenAt);
  const away = now - lastSeen;
  const since = new Date(Math.max(lastSeen, now - 7 * 86_400_000)).toISOString();
  const catchUpOn = await isFlagOn("catchUp");
  const missed =
    catchUpOn && away > 20 * 3_600_000 && view === "for-you" && !channel && !category
      ? catchUp({
          posts: allPosts,
          chat,
          since,
          campusSlug: viewer.profile.campusSlug,
          channelLabels: Object.fromEntries(loopChannels.map((entry) => [entry.slug, entry.label])),
        })
      : null;

  let sentence: string | null = null;
  if (missed && missed.lines.length > 0 && viewer.entitlements.can.loopCatchUp) {
    try {
      const result = await runAi<string>({
        operation: "summarize",
        userId: viewer.user.id,
        scope: `${viewer.profile.citySlug}:catchup:${since.slice(0, 10)}`,
        payload: missed.lines.map((line) => ({ title: line.title, channel: line.channel })),
        system: BASE_SYSTEM,
        prompt: [
          "These are the community posts and rooms a student missed. Write ONE sentence, under 30 words,",
          "saying what students in the city are mostly talking about. Refer only to these titles.",
          /* Post titles are written by other students. Fenced as data — this is
             the surface where an "instruction" would most plausibly be typed,
             because the thing being summarised IS what people wrote. */
          untrusted(JSON.stringify(missed.lines.map((line) => line.title))),
          "<<render>>",
          "",
        ].join("\n"),
        parse: (text) => text.trim(),
        fallback: () => "",
      });
      sentence = result.value || null;
    } catch {
      sentence = null;
    }
  }

  const urlWith = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams();
    const current = {
      view: view === "for-you" ? null : view,
      channel,
      category: category?.value ?? null,
      ...patch,
    };
    for (const [key, value] of Object.entries(current)) if (value) next.set(key, value);
    const qs = next.toString();
    return qs ? `/pulse?${qs}` : "/pulse";
  };

  const activeView = feedViews.find((entry) => entry.value === view)!;
  /* The chat room this filter pairs with, for the cross-link. */
  const pairedChat = channel ?? category?.chat ?? null;
  const pairedLabel = pairedChat ? (loopChannels.find((entry) => entry.slug === pairedChat)?.label ?? pairedChat) : null;
  const composerChannel = channel ?? category?.postChannel ?? "general";

  return (
    <div className="page py-6 sm:py-8">
      <header className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
            {viewer.city.name}
            {viewer.campusName ? ` · ${viewer.campusName}` : ""}
          </p>
          <h1 className="mt-1 text-display-xs text-ink-950 sm:text-display-sm">{brand.surfaces.pulse}</h1>
        </div>
        <Link
          href="/pulse/chat"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[0.875rem] font-medium text-ink-700 ring-1 ring-ink-950/8 hover:ring-ink-950/20"
        >
          <MessagesSquare className="size-4" />
          Chat
        </Link>
      </header>

      {/* ---- views -------------------------------------------------------- */}
      <nav
        aria-label="Feed views"
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar edge-fade-x sm:mx-0 sm:px-0 sm:[mask-image:none]"
      >
        {feedViews.map((entry) => (
          <Link
            key={entry.value}
            href={urlWith({ view: entry.value === "for-you" ? null : entry.value })}
            aria-current={view === entry.value ? "page" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-[0.875rem] font-medium transition-colors",
              view === entry.value
                ? "bg-ink-950 text-paper"
                : "bg-white text-ink-700 ring-1 ring-ink-950/8 hover:ring-ink-950/20",
            )}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      {/* ---- categories --------------------------------------------------- */}
      <nav
        aria-label="Categories"
        className="-mx-5 mt-2.5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar edge-fade-x sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none]"
      >
        <Link
          href={urlWith({ category: null, channel: null })}
          className={cn(
            "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[0.8125rem] font-medium transition-colors",
            !category && !channel ? "bg-paper-3 text-ink-900" : "bg-paper-2 text-ink-600 hover:bg-ink-100",
          )}
        >
          All
        </Link>
        {pulseCategories.map((entry) => (
          <Link
            key={entry.value}
            href={urlWith({ category: category?.value === entry.value ? null : entry.value, channel: null })}
            className={cn(
              "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[0.8125rem] font-medium transition-colors",
              category?.value === entry.value ? "bg-paper-3 text-ink-900" : "bg-paper-2 text-ink-600 hover:bg-ink-100",
            )}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      <p className="mt-2.5 flex flex-wrap items-center gap-x-2 text-[0.8125rem] text-ink-500">
        <span>{activeView.hint}</span>
        {pairedChat ? (
          <Link
            href={`/pulse/chat/${pairedChat}`}
            className="inline-flex items-center gap-1.5 font-medium text-ink-700 underline underline-offset-4 hover:text-ink-950"
          >
            <MessagesSquare className="size-3.5" />
            Chat in #{pairedLabel}
          </Link>
        ) : null}
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.7fr_1fr] lg:items-start">
        {/* ---- feed ------------------------------------------------------- */}
        <div className="space-y-4">
          {missed && missed.lines.length > 0 ? <CatchUpCard catchUp={missed} sentence={sentence} /> : null}

          {view === "campus" && !viewer.profile.campusSlug ? (
            <div className="rounded-2xl bg-white p-5 ring-1 ring-ink-950/6">
              <p className="text-[0.9375rem] text-ink-700">
                Campus is the feed for your own university. Add where you study and it fills in — until then this
                view would just be the whole city again.
              </p>
              <Link
                href="/you/profile"
                className="mt-3 inline-flex rounded-full bg-ink-950 px-4 py-2 text-[0.875rem] font-medium text-paper"
              >
                Add your university
              </Link>
            </div>
          ) : feed.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl bg-white px-5 py-10 text-center ring-1 ring-ink-950/6">
              <MascotArt state="empty" className="size-16" />
              <p className="mt-4 text-[0.9375rem] text-ink-700">
                {view === "following"
                  ? "You are not following anyone yet. Follow a few people and their posts land here."
                  : view === "trending"
                    ? "Nothing has taken off in the last three days. Post something worth talking about."
                    : "This corner is quiet. Start the conversation."}
              </p>
              <Link
                href={view === "following" ? "/you/friends" : "/pulse"}
                className="mt-4 rounded-full bg-ink-950 px-4 py-2 text-[0.875rem] font-medium text-paper"
              >
                {view === "following" ? "Find people" : "See everything"}
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {feed.map((entry) => (
                <li key={entry.post.id}>
                  <PulseCard entry={entry} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ---- side ------------------------------------------------------- */}
        <div className="space-y-4 lg:sticky lg:top-24">
          <div className="hidden lg:block">
            <Composer channels={loopChannels} attachables={attachables} defaultChannel={composerChannel} />
          </div>

          <section className="rounded-2xl bg-white p-4 ring-1 ring-ink-950/6">
            <h2 className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">Channels</h2>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {loopChannels.map((entry) => (
                <li key={entry.slug}>
                  <Link
                    href={urlWith({ channel: channel === entry.slug ? null : entry.slug, category: null })}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-medium transition-colors",
                      channel === entry.slug ? "bg-ink-950 text-paper" : "bg-paper-2 text-ink-600 hover:bg-ink-100",
                    )}
                  >
                    <span aria-hidden>{entry.emoji}</span>
                    {entry.label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[0.8125rem] text-ink-500">
              Every channel is a feed and a room.{" "}
              <Link href="/pulse/chat" className="font-medium text-ink-700 underline underline-offset-4 hover:text-ink-950">
                Open the rooms
              </Link>
            </p>
          </section>
        </div>
      </div>

      {/* ---- mobile composer ---------------------------------------------- */}
      <ComposerSheet channels={loopChannels} attachables={attachables} defaultChannel={composerChannel} />
    </div>
  );
}
