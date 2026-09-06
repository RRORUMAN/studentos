"use client";

import { ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MascotArt } from "@/components/mascot/mascot-art";
import { brand } from "@/brand/brand.config";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * ASK BAR
 * ----------------------------------------------------------------------------
 * The entry point to the AI concierge, on Home.
 *
 * The suggestions are the important part. An empty box labelled "ask me
 * anything" is the most common way an AI feature fails: people do not know what
 * it can do, type something it cannot answer, and never come back. These are
 * generated from the student's actual situation — their stage, their remaining
 * budget, the day of the week — so every one is a question this product can
 * genuinely answer well right now.
 * ============================================================================
 */

export function AskBar({
  suggestions,
  safeTodayLabel,
}: {
  suggestions: readonly string[];
  safeTodayLabel: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");

  const go = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/ask?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <section aria-labelledby="ask-heading">
      <h2 id="ask-heading" className="sr-only">
        Ask {brand.name}
      </h2>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          go(value);
        }}
        className="flex items-center gap-2.5"
      >
        <MascotArt state="neutral" idle className="hidden size-11 shrink-0 sm:block" />

        <div className="relative flex-1">
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={`Ask ${brand.name} anything...`}
            aria-label={`Ask ${brand.name}`}
            className={cn(
              "h-13 w-full rounded-full border border-ink-200 bg-white pr-13 pl-4.5",
              "text-[0.9375rem] text-ink-900 placeholder:text-ink-400",
              "shadow-[var(--shadow-raise)] transition-[border-color] hover:border-ink-300",
              "focus:border-ink-400",
            )}
          />
          <button
            type="submit"
            aria-label="Ask"
            disabled={value.trim().length === 0}
            className={cn(
              "absolute top-1/2 right-1.5 grid size-10 -translate-y-1/2 place-items-center rounded-full",
              "transition-[background-color,opacity] duration-150",
              value.trim().length === 0
                ? "bg-ink-100 text-ink-400"
                : "bg-ink-950 text-signal hover:bg-ink-800",
            )}
          >
            <ArrowUp className="size-4.5" strokeWidth={2.4} />
          </button>
        </div>
      </form>

      {/* Contextual prompts. Horizontally scrollable rather than wrapped, so
          the block keeps a fixed height whatever the suggestions are. */}
      <div className="-mx-5 mt-2.5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar edge-fade-x sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none]">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => go(suggestion)}
            className="shrink-0 rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-[0.8125rem] font-medium text-ink-600 transition-colors hover:border-ink-300 hover:text-ink-950"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {safeTodayLabel ? (
        <p className="mt-2 text-[0.8125rem] text-ink-400">
          Answers stay inside {safeTodayLabel} unless you say otherwise.
        </p>
      ) : null}
    </section>
  );
}
