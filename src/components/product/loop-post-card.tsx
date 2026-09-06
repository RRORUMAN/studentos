"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  ArrowBigUp,
  Bookmark,
  BookmarkCheck,
  Clock,
  MapPin,
  MessageCircle,
  Share2,
} from "lucide-react";
import { useState } from "react";

import { accents } from "@/components/ui/accent";
import { useToast } from "@/components/ui/toast";
import { loopKindMeta } from "@/data/loop";
import type { LoopPost } from "@/data/types";
import { useCopy } from "@/hooks/use-copy";
import { spring } from "@/lib/motion";
import { ago, cn, count, money } from "@/lib/utils";
import { track } from "@/services/analytics";

/**
 * One Pulse post. Voting, saving and sharing are real client state, so the
 * feed on the marketing site behaves exactly like the feed in the product —
 * it just starts from seeded rows.
 */
export function LoopPostCard({ post, compact = false }: { post: LoopPost; compact?: boolean }) {
  const reduced = useReducedMotion();
  const toast = useToast();
  const { copy } = useCopy();

  const [voted, setVoted] = useState(false);
  const [saved, setSaved] = useState(false);

  const meta = loopKindMeta[post.kind];
  const accent = accents[meta.accent];
  const votes = post.upvotes + (voted ? 1 : 0);

  return (
    <article
      className={cn(
        "group relative rounded-lg border border-white/8 bg-white/[0.03] p-3.5 transition-colors",
        "hover:border-white/16 hover:bg-white/[0.05]",
        compact && "p-3",
      )}
    >
      <div className="flex gap-3">
        {/* vote rail */}
        <div className="flex w-9 shrink-0 flex-col items-center gap-0.5">
          <button
            type="button"
            aria-pressed={voted}
            aria-label={voted ? `Remove your upvote from ${post.title}` : `Upvote ${post.title}`}
            onClick={() => {
              setVoted((current) => !current);
              track("pulse_voted", { postId: post.id, voted: !voted });
            }}
            className={cn(
              "grid size-8 place-items-center rounded-md transition-colors",
              voted
                ? "bg-signal/15 text-signal"
                : "text-white/35 hover:bg-white/8 hover:text-white",
            )}
          >
            <motion.span
              animate={reduced ? undefined : { y: voted ? -1.5 : 0, scale: voted ? 1.12 : 1 }}
              transition={reduced ? { duration: 0 } : spring.bouncy}
            >
              <ArrowBigUp className={cn("size-4.5", voted && "fill-current")} aria-hidden />
            </motion.span>
          </button>
          <span
            className={cn(
              "tnum text-xs font-medium tabular-nums",
              voted ? "text-signal" : "text-white/45",
            )}
          >
            {count(votes)}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.05em]",
                "bg-white/8",
                accent.textOnDark,
              )}
            >
              <span aria-hidden>{meta.glyph}</span>
              {meta.label}
            </span>
            {post.signal ? (
              <span className="text-xs font-medium text-white/70">{post.signal}</span>
            ) : null}
          </div>

          <h3 className="mt-1.5 text-[0.9375rem] leading-snug font-semibold text-white">
            {post.title}
          </h3>

          {post.body && !compact ? (
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-white/55">{post.body}</p>
          ) : null}

          {post.poll ? <PollBars options={post.poll} /> : null}

          {(post.place || post.when || typeof post.price === "number") && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/45">
              {post.place ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden />
                  {post.place}
                </span>
              ) : null}
              {post.when ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden />
                  {post.when}
                </span>
              ) : null}
              {typeof post.price === "number" ? (
                <span className={cn("tnum font-medium", post.price === 0 ? "text-mint" : "text-white/70")}>
                  {post.price === 0 ? "Free" : money(post.price)}
                </span>
              ) : null}
            </div>
          )}

          {!compact && post.tags.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-xs bg-white/6 px-1.5 py-0.5 font-mono text-[0.6875rem] text-white/45"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex items-center gap-1">
            <span className="flex items-center gap-1.5 text-xs text-white/40">
              <span className="font-medium text-white/60">{post.author.handle}</span>
              <span aria-hidden>·</span>
              <span>
                {post.author.terms} {post.author.terms === 1 ? "term" : "terms"} here
              </span>
              <span aria-hidden>·</span>
              <span className="tnum">{ago(post.postedMinutesAgo)}</span>
            </span>

            <div className="ml-auto flex items-center gap-0.5">
              <IconAction label={`${post.comments} comments`}>
                <MessageCircle className="size-3.5" aria-hidden />
                <span className="tnum">{post.comments}</span>
              </IconAction>

              <IconAction
                label={saved ? "Remove from saved" : "Save post"}
                pressed={saved}
                onClick={() => {
                  setSaved((current) => !current);
                  toast({
                    title: saved ? "Removed" : "Saved to your city",
                    description: saved ? undefined : post.title,
                  });
                }}
              >
                {saved ? (
                  <BookmarkCheck className="size-3.5 text-signal" aria-hidden />
                ) : (
                  <Bookmark className="size-3.5" aria-hidden />
                )}
              </IconAction>

              <IconAction
                label="Share post"
                onClick={async () => {
                  const ok = await copy(`${post.title} — ${post.signal ?? ""}`.trim());
                  toast({
                    title: ok ? "Copied" : "Could not copy",
                    tone: ok ? "success" : "warning",
                  });
                }}
              >
                <Share2 className="size-3.5" aria-hidden />
              </IconAction>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function IconAction({
  children,
  label,
  pressed,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  pressed?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-white/40 transition-colors hover:bg-white/8 hover:text-white/80"
    >
      {children}
    </button>
  );
}

function PollBars({ options }: { options: readonly { label: string; share: number }[] }) {
  const reduced = useReducedMotion();
  return (
    <ul className="mt-2.5 flex flex-col gap-1.5">
      {options.map((option, index) => (
        <li key={option.label} className="relative overflow-hidden rounded-sm bg-white/6">
          <motion.span
            aria-hidden
            className="absolute inset-y-0 left-0 bg-flow/35"
            initial={reduced ? false : { width: 0 }}
            whileInView={{ width: `${option.share}%` }}
            viewport={{ once: true, amount: 0.6 }}
            transition={reduced ? { duration: 0 } : { duration: 0.6, delay: index * 0.06 }}
          />
          <span className="relative flex items-center justify-between px-2.5 py-1.5 text-xs">
            <span className="text-white/80">{option.label}</span>
            <span className="tnum text-white/50">{option.share}%</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
