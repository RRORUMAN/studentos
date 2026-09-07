"use client";

import { Bookmark, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { savePlanFromAnswer } from "@/server/actions/plans";
import type { WeekItem } from "@/server/engines/week";

/** Save the generated week as a plan. Lines are re-read from their rows on the server. */
export function SaveWeekButton({
  items,
  weekStartIso,
  budgetCents,
}: {
  items: readonly WeekItem[];
  weekStartIso: string;
  budgetCents: number | null;
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
            title: `Week of ${new Date(weekStartIso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
            query: "Plan my week",
            budgetCents,
            forDate: weekStartIso,
            lines: items.map((item) => ({
              time: new Date(item.dateIso).toLocaleDateString("en-GB", { weekday: "short" }),
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
