"use client";

import { Bookmark, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { fmtDayLabel, fmtWeekday } from "@/lib/dates";
import { savePlanFromAnswer } from "@/server/actions/plans";
import type { WeekItem } from "@/server/engines/week";

/**
 * Save the generated week as a plan. Lines are re-read from their rows on the
 * server.
 *
 * `timeZone` is a prop rather than the browser's own zone, and the title and
 * the day on every line are what it decides. This runs in the browser, so
 * without it a student opening the planner from an airport in another country
 * would save "Week of 11 Sep" with Thursday's gigs filed under Wednesday —
 * into rows that outlive the trip. The day a plan is about is a day in the city
 * the plan is for.
 */
export function SaveWeekButton({
  items,
  weekStartIso,
  budgetCents,
  timeZone,
}: {
  items: readonly WeekItem[];
  weekStartIso: string;
  budgetCents: number | null;
  timeZone: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="primary"
      size="lg"
      block
      disabled={pending || saved !== null}
      onClick={() =>
        startTransition(async () => {
          const result = await savePlanFromAnswer({
            title: `Week of ${fmtDayLabel(weekStartIso, timeZone)}`,
            query: "Plan my week",
            budgetCents,
            forDate: weekStartIso,
            lines: items.map((item) => ({
              time: fmtWeekday(item.dateIso, timeZone),
              title: item.title,
              detail: item.detail,
              priceCents: item.priceCents,
              walkMinutes: item.walkMinutes,
              kind: item.kind === "event" ? "event" : "activity",
              source: "students",
              refKind: item.kind,
              refId: item.refId,
            })),
          });
          if (result.ok) {
            setSaved(result.id);
            toast({ title: "Saved to Plans", description: "Opening the plan." });
            router.push(`/plans/${result.id}`);
          } else {
            toast({ tone: "warning", title: result.message });
          }
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4 text-signal" /> : <Bookmark className="size-4" />}
      {saved ? "Saved to Plans" : "Save this week as a plan"}
    </Button>
  );
}
