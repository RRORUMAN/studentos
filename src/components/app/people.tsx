"use client";

import { Check, Loader2, MessageSquare, RotateCcw, ShieldCheck, UserMinus, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useToast } from "@/components/ui/toast";
import { startDirectMessage } from "@/server/actions/chat";
import type { FriendshipState, PublicProfile } from "@/server/queries/social";
import {
  acceptFriendRequest,
  blockStudent,
  declineFriendRequest,
  followStudent,
  removeFriend,
  sendFriendRequest,
  unblockStudent,
  unfollowStudent,
} from "@/server/actions/friends";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * PEOPLE
 * ----------------------------------------------------------------------------
 * The row a student appears as, everywhere in the product.
 *
 * What it shows is deliberately thin: a first name, an avatar, a campus, and
 * *why they are being suggested*. No photo, no age, no last-seen, no distance.
 * This is a product for finding someone to play football with, and every field
 * beyond that is one a stranger did not need.
 *
 * Blocking is reversible from the same row it happened on. A block with no
 * visible way back is a support ticket waiting to be filed.
 * ============================================================================
 */

export function PersonRow({
  profile,
  state,
  reason,
  following,
  canMessage = true,
  onChanged,
}: {
  profile: PublicProfile;
  state: FriendshipState;
  /** Why this person is here. Suggestions without a reason are noise. */
  reason?: string;
  /** Whether the viewer already follows them, when the list knows. */
  following?: boolean;
  /** False on rows where a DM is not offered (a blocked person). */
  canMessage?: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = useState(state);
  const [isFollowing, setIsFollowing] = useState(Boolean(following));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const act = (fn: () => Promise<{ ok: boolean; message?: string }>, next: FriendshipState) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setCurrent(next);
        onChanged?.();
        router.refresh();
      } else {
        setError(result.message ?? "That did not work.");
      }
    });
  };

  const message = () => {
    setError(null);
    startTransition(async () => {
      const result = await startDirectMessage(profile.userId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/pulse/chat/${result.channel}`);
    });
  };

  const follow = () => {
    const next = !isFollowing;
    setIsFollowing(next);
    startTransition(async () => {
      const result = next ? await followStudent(profile.userId) : await unfollowStudent(profile.userId);
      if (!result.ok) {
        setIsFollowing(!next);
        toast({ title: "That did not work", description: result.message, tone: "warning" });
        return;
      }
      router.refresh();
    });
  };

  return (
    <li className="flex items-center gap-3 rounded-xl bg-white p-3.5 ring-1 ring-ink-950/6">
      <span
        aria-hidden
        className="grid size-11 shrink-0 place-items-center rounded-full bg-signal-soft text-xl ring-1 ring-ink-950/8"
      >
        {profile.avatarEmoji}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[0.9375rem] font-medium text-ink-950">
          {profile.displayName}
          {profile.verified ? (
            <ShieldCheck className="size-3.5 text-mint-deep" aria-label="Student verified" />
          ) : null}
        </p>
        <p className="mt-0.5 truncate text-[0.8125rem] text-ink-500">
          {reason ??
            [
              profile.campusSlug?.toUpperCase(),
              profile.termsInCity === null ? null : `${profile.termsInCity} terms here`,
            ]
              .filter(Boolean)
              .join(" · ")}
        </p>
        {error ? (
          <p role="alert" className="mt-1 text-[0.75rem] text-pulse-deep">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {pending ? <Loader2 className="size-4 animate-spin text-ink-400" /> : null}

        {current !== "blocked" && canMessage ? (
          <button
            type="button"
            disabled={pending}
            onClick={message}
            aria-label={`Message ${profile.displayName}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-paper-2 px-3 py-1.5 text-[0.8125rem] font-medium text-ink-700 hover:bg-ink-100"
          >
            <MessageSquare className="size-3.5" />
            Message
          </button>
        ) : null}

        {current === "none" ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={follow}
              aria-pressed={isFollowing}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors",
                isFollowing ? "bg-ink-100 text-ink-700" : "bg-paper-2 text-ink-700 hover:bg-ink-100",
              )}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => act(() => sendFriendRequest(profile.userId), "pending-sent")}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink-950 px-3.5 py-2 text-[0.8125rem] font-medium text-paper hover:bg-ink-800"
            >
              <UserPlus className="size-3.5" />
              Add
            </button>
          </>
        ) : null}

        {current === "pending-sent" ? (
          <span className="rounded-full bg-ink-100 px-3 py-1.5 text-[0.8125rem] font-medium text-ink-500">
            Requested
          </span>
        ) : null}

        {current === "pending-received" ? (
          <>
            <button
              type="button"
              disabled={pending}
              aria-label={`Accept ${profile.displayName}`}
              onClick={() => act(() => acceptFriendRequest(profile.userId), "friends")}
              className="grid size-9 place-items-center rounded-full bg-ink-950 text-signal hover:bg-ink-800"
            >
              <Check className="size-4" />
            </button>
            <button
              type="button"
              disabled={pending}
              aria-label={`Decline ${profile.displayName}`}
              onClick={() => act(() => declineFriendRequest(profile.userId), "none")}
              className="grid size-9 place-items-center rounded-full ring-1 ring-ink-950/10 text-ink-500 hover:ring-ink-950/25"
            >
              <X className="size-4" />
            </button>
          </>
        ) : null}

        {current === "friends" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => act(() => removeFriend(profile.userId), "none")}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium text-ink-600 ring-1 ring-ink-950/10 hover:ring-ink-950/25"
          >
            <UserMinus className="size-3.5" />
            Friends
          </button>
        ) : null}

        {current !== "blocked" && current !== "friends" ? (
          <button
            type="button"
            disabled={pending}
            aria-label={`Block ${profile.displayName}`}
            title="Block"
            onClick={() => act(() => blockStudent(profile.userId), "blocked")}
            className="grid size-9 place-items-center rounded-full text-ink-300 hover:bg-pulse-soft hover:text-pulse-deep"
          >
            <X className="size-3.5" />
          </button>
        ) : null}

        {current === "blocked" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => act(() => unblockStudent(profile.userId), "none")}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium text-ink-700 ring-1 ring-ink-950/10 hover:ring-ink-950/25"
          >
            <RotateCcw className="size-3.5" />
            Unblock
          </button>
        ) : null}
      </div>
    </li>
  );
}
