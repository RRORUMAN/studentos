"use client";

import { Check, Loader2, ShieldCheck, UserMinus, UserPlus, X } from "lucide-react";
import { useState, useTransition } from "react";

import type { FriendshipState, PublicProfile } from "@/server/queries/social";
import {
  acceptFriendRequest,
  blockStudent,
  declineFriendRequest,
  removeFriend,
  sendFriendRequest,
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
 * ============================================================================
 */

export function PersonRow({
  profile,
  state,
  reason,
  onChanged,
}: {
  profile: PublicProfile;
  state: FriendshipState;
  /** Why this person is here. Suggestions without a reason are noise. */
  reason?: string;
  onChanged?: () => void;
}) {
  const [current, setCurrent] = useState(state);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const act = (fn: () => Promise<{ ok: boolean; message?: string }>, next: FriendshipState) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setCurrent(next);
        onChanged?.();
      } else {
        setError(result.message ?? "That did not work.");
      }
    });
  };

  return (
    <li className="flex items-center gap-3 rounded-lg border border-ink-200 bg-white p-3.5">
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
            [profile.campusSlug?.toUpperCase(), `${profile.termsInCity} terms here`]
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

        {current === "none" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => act(() => sendFriendRequest(profile.userId), "pending-sent")}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink-950 px-3.5 py-2 text-[0.8125rem] font-medium text-paper hover:bg-ink-800"
          >
            <UserPlus className="size-3.5" />
            Add
          </button>
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
              className="grid size-9 place-items-center rounded-full border border-ink-200 text-ink-500 hover:border-ink-300"
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
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5",
              "text-[0.8125rem] font-medium text-ink-600 hover:border-ink-300",
            )}
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
          <span className="rounded-full bg-ink-100 px-3 py-1.5 text-[0.8125rem] font-medium text-ink-500">
            Blocked
          </span>
        ) : null}
      </div>
    </li>
  );
}
