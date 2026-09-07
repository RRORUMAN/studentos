"use client";

import { ExternalLink, Flag, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useToast } from "@/components/ui/toast";
import { type ApplicationStatus, applicationStatusMeta, applicationStatuses } from "@/domain/work";
import {
  messageAboutGig,
  reportOpportunity,
  setApplicationStatus,
} from "@/server/actions/work";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * APPLYING, TRACKING, REPORTING
 * ----------------------------------------------------------------------------
 * The controls on an opportunity, and the one place in this pillar where the
 * "no dead buttons" rule has real teeth.
 *
 * There are exactly three ways to apply and each renders differently, because
 * each is a genuinely different promise:
 *
 *   A STUDENT GIG opens a chat with the person who posted it. It works.
 *   Sending the message also marks it applied, because saying so twice is
 *   busywork.
 *
 *   AN EXTERNAL POSTING opens the source in a new tab, and then asks — after
 *   the fact and as a separate tap — whether to mark it applied. Opening a
 *   link is not applying, and a tracker that assumes otherwise will tell a
 *   student they have applied for a job they closed after four seconds.
 *
 *   A SAMPLE POSTING says there is nobody to apply to. It does not render a
 *   button that quietly does nothing, and it does not hide the fact that the
 *   row is illustrative behind a disabled control with no explanation.
 * ============================================================================
 */

export function ApplyControls({
  opportunityId,
  method,
  applicationUrl,
  isSample,
  isOwn,
  status,
}: {
  opportunityId: string;
  method: "external-url" | "email" | "internal";
  applicationUrl: string | null;
  isSample: boolean;
  isOwn: boolean;
  status: ApplicationStatus | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  if (isOwn) {
    return (
      <p className="rounded-xl bg-ink-100 px-4 py-3 text-[0.875rem] text-ink-600">
        This is your posting. Students who reply will reach you in Pulse chat.
      </p>
    );
  }

  if (isSample) {
    return (
      <p className="rounded-xl bg-amber-soft px-4 py-3 text-[0.875rem] leading-relaxed text-ink-800">
        <strong className="font-semibold">This is a sample posting.</strong> It is here so the
        matching and the filters have something to work on before real employers arrive. There is
        nobody to apply to, so there is no apply button — you would be sending it into nothing.
      </p>
    );
  }

  if (method === "internal") {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await messageAboutGig(opportunityId);
              if (result.ok) {
                toast({ title: "Message sent", description: "Agree the price before anyone starts." });
                router.push(`/pulse/chat/${result.channel}`);
              } else {
                toast({ tone: "warning", title: result.message });
              }
            })
          }
          className="inline-flex items-center gap-2 rounded-full bg-ink-950 px-5 py-2.5 text-[0.9375rem] font-semibold text-paper transition-colors hover:bg-ink-800 disabled:opacity-50"
        >
          <MessageSquare className="size-4" />
          {status === "applied" ? "Message again" : "I can do this"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {applicationUrl ? (
        <a
          href={applicationUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-2 rounded-full bg-ink-950 px-5 py-2.5 text-[0.9375rem] font-semibold text-paper transition-colors hover:bg-ink-800"
        >
          <ExternalLink className="size-4" />
          Apply at the source
        </a>
      ) : (
        <p className="text-[0.875rem] text-ink-500">
          This posting gave no way to apply. That is a fault in the source, not a step you are
          missing.
        </p>
      )}

      {status !== "applied" && status !== "interview" && status !== "offer" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await setApplicationStatus(opportunityId, "applied");
              toast(
                result.ok
                  ? { title: "Marked as applied" }
                  : { tone: "warning", title: result.message },
              );
            })
          }
          className="rounded-full bg-white px-4 py-2.5 text-[0.875rem] font-medium text-ink-700 ring-1 ring-ink-950/8 transition-colors hover:text-ink-950 disabled:opacity-50"
        >
          I applied
        </button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The tracker control                                                         */
/* -------------------------------------------------------------------------- */

export function StatusPicker({
  opportunityId,
  status,
}: {
  opportunityId: string;
  status: ApplicationStatus | null;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState<ApplicationStatus | null>(status);

  return (
    <div className="flex flex-wrap gap-1.5">
      {applicationStatuses.map((candidate) => (
        <button
          key={candidate}
          type="button"
          disabled={pending}
          aria-pressed={current === candidate}
          onClick={() =>
            start(async () => {
              const result = await setApplicationStatus(opportunityId, candidate);
              if (result.ok) setCurrent(candidate);
              toast(
                result.ok
                  ? { title: result.message ?? "Saved" }
                  : { tone: "warning", title: result.message },
              );
            })
          }
          className={cn(
            "rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors disabled:opacity-50",
            current === candidate
              ? "bg-ink-950 text-paper"
              : "bg-white text-ink-600 ring-1 ring-ink-950/8 hover:text-ink-950",
          )}
        >
          {applicationStatusMeta[candidate].label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Reporting                                                                   */
/* -------------------------------------------------------------------------- */

const REASONS = [
  { value: "scam", label: "It looks like a scam" },
  { value: "expired", label: "The job is gone" },
  { value: "wrong-info", label: "The details are wrong" },
  { value: "unsafe", label: "It felt unsafe" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Something else" },
] as const;

export function ReportOpportunity({ opportunityId }: { opportunityId: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-500 hover:text-ink-950"
      >
        <Flag className="size-3.5" />
        Report this posting
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-ink-950/8">
      <p className="text-[0.875rem] font-medium text-ink-950">What is wrong with it?</p>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-500">
        Reports are anonymous. Reporting it as a scam takes it off the board immediately, before a
        moderator has looked — we would rather be wrong for a day than slow.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {REASONS.map((reason) => (
          <button
            key={reason.value}
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await reportOpportunity(opportunityId, reason.value);
                toast(
                  result.ok
                    ? { title: result.message ?? "Reported" }
                    : { tone: "warning", title: result.message },
                );
                setOpen(false);
              })
            }
            className="rounded-full bg-paper-2 px-3 py-1.5 text-[0.8125rem] font-medium text-ink-700 ring-1 ring-ink-950/8 transition-colors hover:text-ink-950 disabled:opacity-50"
          >
            {reason.label}
          </button>
        ))}
      </div>
    </div>
  );
}
