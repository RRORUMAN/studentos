"use client";

import { Bookmark, Check, Flag, Link2, Loader2, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useToast } from "@/components/ui/toast";
import { useCopy } from "@/hooks/use-copy";
import type { ListingStatus } from "@/domain/social";
import { messageAboutListing, reportListing, setListingStatus } from "@/server/actions/exchange";
import { toggleSaved } from "@/server/actions/saved";
import { cn } from "@/lib/utils";

/**
 * The buttons on a listing: message, save, share, report for everyone else;
 * status controls for the poster. Every one is a server action with a toast.
 */
export function ListingActions({
  listingId,
  saved: initialSaved,
  mine,
  status,
  shareUrl,
  requestMode,
}: {
  listingId: string;
  saved: boolean;
  mine: boolean;
  status: ListingStatus;
  shareUrl: string;
  requestMode: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { copy, copied } = useCopy();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, start] = useTransition();
  const [reporting, setReporting] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {!mine ? (
          <button
            type="button"
            disabled={pending || status === "withdrawn"}
            onClick={() =>
              start(async () => {
                const result = await messageAboutListing(listingId);
                if (!result.ok) {
                  toast({ title: result.message, tone: "warning" });
                  return;
                }
                router.push(`/pulse/chat/${result.channel}`);
              })
            }
            className="inline-flex h-11 items-center gap-2 rounded-full bg-ink-950 px-5 text-[0.9375rem] font-semibold text-paper hover:bg-ink-800 disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare className="size-4" />}
            {requestMode ? "I can help" : "Message"}
          </button>
        ) : null}

        <button
          type="button"
          aria-pressed={saved}
          disabled={pending}
          onClick={() => {
            const next = !saved;
            setSaved(next);
            start(async () => {
              const result = await toggleSaved("listing", listingId);
              if (!result.ok) {
                setSaved(!next);
                toast({ title: result.reason === "quota" ? `Saved is full (${result.used}/${result.limit}).` : result.message, tone: "warning" });
                return;
              }
              toast({ title: result.saved ? "Saved." : "Removed from Saved." });
              router.refresh();
            });
          }}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-full px-4 text-[0.9375rem] font-medium ring-1 transition-colors",
            saved ? "bg-signal-soft text-signal-deep ring-signal-deep/20" : "bg-white text-ink-800 ring-ink-950/8 hover:ring-ink-950/20",
          )}
        >
          <Bookmark className={cn("size-4", saved && "fill-current")} />
          {saved ? "Saved" : "Save"}
        </button>

        <button
          type="button"
          onClick={async () => {
            const ok = await copy(shareUrl);
            toast({ title: ok ? "Link copied." : "Could not copy the link." });
          }}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-[0.9375rem] font-medium text-ink-800 ring-1 ring-ink-950/8 hover:ring-ink-950/20"
        >
          {copied ? <Check className="size-4 text-mint-deep" /> : <Link2 className="size-4" />}
          {copied ? "Copied" : "Share"}
        </button>

        {!mine ? (
          <button
            type="button"
            onClick={() => setReporting((open) => !open)}
            aria-expanded={reporting}
            className="inline-flex h-11 items-center gap-2 rounded-full px-3 text-[0.875rem] font-medium text-ink-500 hover:text-pulse-deep"
          >
            <Flag className="size-4" />
            Report
          </button>
        ) : null}
      </div>

      {reporting ? (
        <ReportForm
          onDone={() => setReporting(false)}
          submit={(reason, note) =>
            start(async () => {
              const result = await reportListing(listingId, reason, note);
              toast({ title: result.ok ? (result.message ?? "Reported.") : result.message, tone: result.ok ? "success" : "warning" });
              setReporting(false);
            })
          }
        />
      ) : null}

      {mine ? (
        <div className="flex flex-wrap gap-2 rounded-xl bg-paper-2 p-3">
          <span className="mr-1 self-center font-mono text-micro uppercase tracking-[0.1em] text-ink-400">Your listing</span>
          {(
            [
              ["active", "Active"],
              ["reserved", "Reserved"],
              [requestMode ? "completed" : "sold", requestMode ? "Sorted" : "Sold"],
              ["withdrawn", "Take down"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={pending || status === value}
              onClick={() =>
                start(async () => {
                  const result = await setListingStatus(listingId, value);
                  toast({ title: result.ok ? (result.message ?? "Updated.") : result.message, tone: result.ok ? "success" : "warning" });
                  router.refresh();
                })
              }
              className={cn(
                "h-9 rounded-full px-3.5 text-[0.8125rem] font-medium transition-colors",
                status === value ? "bg-ink-950 text-paper" : "bg-white text-ink-700 ring-1 ring-ink-950/8 hover:ring-ink-950/20",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReportForm({ submit, onDone }: { submit: (reason: string, note: string) => void; onDone: () => void }) {
  const [reason, setReason] = useState("scam");
  const [note, setNote] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit(reason, note);
      }}
      className="rounded-xl bg-pulse-soft/40 p-4 ring-1 ring-pulse-deep/15"
    >
      <p className="text-[0.875rem] font-medium text-ink-900">What is wrong with it?</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(
          [
            ["scam", "Looks like a scam"],
            ["unsafe", "Unsafe meeting or request"],
            ["spam", "Spam"],
            ["harassment", "Harassment"],
            ["wrong-info", "Wrong information"],
            ["other", "Something else"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={reason === value}
            onClick={() => setReason(value)}
            className={cn("h-8 rounded-full px-3 text-[0.8125rem] font-medium", reason === value ? "bg-ink-950 text-paper" : "bg-white text-ink-700 ring-1 ring-ink-950/8")}
          >
            {label}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={2}
        placeholder="Anything that helps (optional)"
        className="mt-2 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-[0.875rem]"
      />
      <div className="mt-2 flex gap-2">
        <button type="submit" className="h-9 rounded-full bg-ink-950 px-4 text-[0.8125rem] font-semibold text-paper">Send report</button>
        <button type="button" onClick={onDone} className="h-9 rounded-full px-3 text-[0.8125rem] font-medium text-ink-500">Cancel</button>
      </div>
      <p className="mt-2 text-[0.75rem] text-ink-500">Reports are anonymous. The poster is never told who reported them.</p>
    </form>
  );
}
