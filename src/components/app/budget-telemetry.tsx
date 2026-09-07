"use client";

import { useEffect } from "react";

import { noteUpgradeMoment } from "@/server/actions/budget";

/**
 * Records that a value-first upsell was shown, after the page has rendered.
 *
 * It used to be an `await` in the middle of the Budget component body, which
 * made a render do a database write — the render then blocked on analytics,
 * and React is free to render a tree more than once, so the same "moment"
 * could be counted twice. This fires once, from an effect, after paint.
 *
 * The trigger name is the only thing that crosses the wire; the user comes
 * from the session inside the action.
 */
export function BudgetTelemetry({ trigger }: { trigger: string | null }) {
  useEffect(() => {
    if (!trigger) return;
    void noteUpgradeMoment(trigger);
  }, [trigger]);

  return null;
}
