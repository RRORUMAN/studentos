"use client";

import { Check, ExternalLink, Link2, Loader2, Play, Share2, SkipForward, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useToast } from "@/components/ui/toast";
import { useCopy } from "@/hooks/use-copy";
import { type MissionStep, missionStepKindMeta } from "@/domain/missions";
import {
  abandonMission,
  inviteFriendToMission,
  rebuildMission,
  shareMission,
  skipMissionStep,
  startMission,
  toggleMissionStep,
  unshareMission,
} from "@/server/actions/missions";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * MISSION UI
 * ----------------------------------------------------------------------------
 * The step list and the action row. Every step is a real row or an honest
 * open task; ticking one is a server action; the total and the progress bar
 * are recomputed on refresh from the rows, never from local state alone.
 * ============================================================================
 */

export function StartMissionButton({
  templateKey,
  label = "Start mission",
  variant,
  size = "md",
}: {
  templateKey: string;
  label?: string;
  variant?: { cheaper?: boolean; social?: boolean };
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await startMission(templateKey, variant);
          if (!result.ok) {
            toast({ title: result.message, tone: "warning" });
            return;
          }
          toast({ title: result.message ?? "Mission started." });
          router.push(`/missions/${result.id}`);
        })
      }
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full bg-ink-950 font-semibold text-paper transition-colors hover:bg-ink-800 disabled:opacity-60",
        size === "sm" ? "h-9 px-3.5 text-[0.8125rem]" : "h-11 px-5 text-[0.9375rem]",
      )}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
      {label}
    </button>
  );
}

export function MissionSteps({
  steps,
  priceLabels,
  readOnly = false,
}: {
  steps: readonly MissionStep[];
  priceLabels: Record<string, string>;
  readOnly?: boolean;
}) {
  return (
    <ol className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
      {steps.map((step) => (
        <StepRow key={step.id} step={step} priceLabel={priceLabels[step.id] ?? ""} readOnly={readOnly} />
      ))}
    </ol>
  );
}

function StepRow({ step, priceLabel, readOnly }: { step: MissionStep; priceLabel: string; readOnly: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(step.doneAt !== null);
  const skipped = step.skippedAt !== null;
  const meta = missionStepKindMeta[step.kind];
  const fixed = step.kind === "transport" || step.kind === "buffer";

  return (
    <li className={cn("flex items-start gap-3 px-4 py-3.5", (done || skipped) && "bg-paper-2/60")}>
      {readOnly || fixed ? (
        <span className="mt-0.5 grid size-5 shrink-0 place-items-center text-[0.75rem]" aria-hidden>
          {fixed ? meta.emoji : done ? "✓" : "○"}
        </span>
      ) : (
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `Mark "${step.label}" not done` : `Mark "${step.label}" done`}
          disabled={pending || skipped}
          onClick={() => {
            const next = !done;
            setDone(next);
            start(async () => {
              const result = await toggleMissionStep(step.id);
              if (!result.ok) {
                setDone(!next);
                toast({ title: result.message, tone: "warning" });
                return;
              }
              if (result.completed) toast({ title: "Mission complete. Properly.", description: "It is on your You page now." });
              router.refresh();
            });
          }}
          className={cn(
            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
            done ? "border-ink-950 bg-ink-950" : "border-ink-300 bg-white hover:border-ink-500",
          )}
        >
          {pending ? <Loader2 className="size-3 animate-spin text-ink-400" /> : done ? <Check className="size-3 text-signal" strokeWidth={3} /> : null}
        </button>
      )}

      <div className="min-w-0 flex-1">
        <p className={cn("text-[0.9375rem] font-medium", done || skipped ? "text-ink-400 line-through" : "text-ink-900")}>
          {step.href && !readOnly ? (
            <Link href={step.href} className="hover:underline">{step.label}</Link>
          ) : (
            step.label
          )}
          {step.optional ? <span className="ml-1.5 font-mono text-micro uppercase tracking-[0.08em] text-ink-400">optional</span> : null}
        </p>
        {step.detail ? <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-500">{step.detail}</p> : null}
        {!readOnly && step.href && !step.refId ? (
          <Link href={step.href} className="mt-1 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-ink-700 underline underline-offset-4">
            Pick one
            <ExternalLink className="size-3" />
          </Link>
        ) : null}
      </div>

      <span className={cn("tnum shrink-0 pt-0.5 font-mono text-[0.9375rem] font-medium", step.priceCents === 0 ? "text-mint-deep" : "text-ink-900")}>
        {priceLabel}
      </span>

      {!readOnly && step.optional && !done ? (
        <button
          type="button"
          aria-label={skipped ? `Put "${step.label}" back` : `Skip "${step.label}"`}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await skipMissionStep(step.id);
              if (!result.ok) toast({ title: result.message, tone: "warning" });
              router.refresh();
            })
          }
          className="grid size-8 shrink-0 place-items-center rounded-full text-ink-300 hover:bg-paper-2 hover:text-ink-900"
        >
          <SkipForward className="size-3.5" />
        </button>
      ) : null}
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                     */
/* -------------------------------------------------------------------------- */

export function MissionActions({
  missionId,
  shareToken,
  siteUrl,
  variant,
  friends,
  status,
  social,
}: {
  missionId: string;
  shareToken: string | null;
  siteUrl: string;
  variant: { cheaper: boolean; social: boolean };
  friends: readonly { userId: string; displayName: string; avatarEmoji: string }[];
  status: "active" | "completed" | "abandoned";
  social: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { copy, copied } = useCopy();
  const [pending, start] = useTransition();
  const [inviting, setInviting] = useState(false);

  const run = (label: string, action: () => Promise<{ ok: boolean; message?: string; token?: string }>) =>
    start(async () => {
      const result = await action();
      if (!result.ok) {
        toast({ title: result.message ?? `${label} failed.`, tone: "warning" });
        return;
      }
      if (result.message) toast({ title: result.message });
      router.refresh();
    });

  const shareUrl = shareToken ? `${siteUrl}/m/${shareToken}` : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {shareUrl ? (
          <button
            type="button"
            onClick={async () => {
              const ok = await copy(shareUrl);
              toast({ title: ok ? "Link copied." : "Could not copy. The link is below." });
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink-950 px-4 text-[0.875rem] font-semibold text-paper hover:bg-ink-800"
          >
            {copied ? <Check className="size-4 text-signal" /> : <Link2 className="size-4" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run("Share", () => shareMission(missionId))}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink-950 px-4 text-[0.875rem] font-semibold text-paper hover:bg-ink-800 disabled:opacity-60"
          >
            <Share2 className="size-4" />
            Share
          </button>
        )}

        {social && friends.length > 0 ? (
          <button
            type="button"
            onClick={() => setInviting((open) => !open)}
            aria-expanded={inviting}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[0.875rem] font-medium text-ink-800 ring-1 ring-ink-950/8 hover:ring-ink-950/20"
          >
            <UsersRound className="size-4" />
            Invite a friend
          </button>
        ) : null}

        <button
          type="button"
          disabled={pending || variant.cheaper}
          onClick={() => run("Rebuild", () => rebuildMission(missionId, { cheaper: true }))}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[0.875rem] font-medium text-ink-800 ring-1 ring-ink-950/8 hover:ring-ink-950/20 disabled:opacity-50"
        >
          Make cheaper
        </button>
        {social ? (
          <button
            type="button"
            disabled={pending || variant.social}
            onClick={() => run("Rebuild", () => rebuildMission(missionId, { social: true }))}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[0.875rem] font-medium text-ink-800 ring-1 ring-ink-950/8 hover:ring-ink-950/20 disabled:opacity-50"
          >
            Make more social
          </button>
        ) : null}
        {status === "active" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run("Stop", () => abandonMission(missionId))}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-medium text-ink-500 hover:text-pulse-deep"
          >
            <X className="size-3.5" />
            Stop
          </button>
        ) : null}
      </div>

      {shareUrl ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-ink-500">
          <span className="min-w-0 truncate font-mono">{shareUrl}</span>
          <button type="button" onClick={() => run("Unshare", () => unshareMission(missionId))} className="font-medium text-ink-700 underline underline-offset-4">
            Switch link off
          </button>
        </p>
      ) : null}

      {inviting ? (
        <ul className="flex flex-wrap gap-2">
          {friends.map((friend) => (
            <li key={friend.userId}>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setInviting(false);
                  run("Invite", () => inviteFriendToMission(missionId, friend.userId));
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-paper-2 px-3 text-[0.8125rem] font-medium text-ink-800 hover:bg-ink-100"
              >
                <span aria-hidden>{friend.avatarEmoji}</span>
                {friend.displayName}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
