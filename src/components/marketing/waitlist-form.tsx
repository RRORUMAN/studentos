"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";
import { useId, useState } from "react";

import type { WaitlistResponse } from "@/app/api/waitlist/route";
import { Button } from "@/components/ui/button";
import { brand } from "@/brand/brand.config";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { track } from "@/services/analytics";
import { captureError } from "@/services/monitoring";

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "stored"; city: string }
  | { kind: "not-configured" }
  | { kind: "error"; message: string };

/**
 * Real form, real endpoint, real states. It never shows a success it cannot
 * back up: with no store connected it says so and offers a route that works.
 */
export function WaitlistForm({
  citySlug,
  cityName,
  onDark = false,
  className,
}: {
  citySlug?: string;
  cityName?: string;
  onDark?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const fieldId = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const invalid = state.kind === "error";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state.kind === "sending") return;
    setState({ kind: "sending" });

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, citySlug }),
      });
      const data = (await response.json()) as WaitlistResponse;

      if (data.status === "invalid") {
        setState({ kind: "error", message: data.message });
        return;
      }
      if (data.status === "stored") {
        track("waitlist_submitted", { citySlug: citySlug ?? null });
        setState({ kind: "stored", city: data.city });
        return;
      }
      track("waitlist_submitted", { citySlug: citySlug ?? null, stored: false });
      setState({ kind: "not-configured" });
    } catch (error) {
      captureError(error, { form: "waitlist" });
      setState({
        kind: "error",
        message: "That did not go through. Check your connection and try again.",
      });
    }
  }

  if (state.kind === "stored" || state.kind === "not-configured") {
    return (
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : duration.base, ease: ease.out }}
        className={cn(
          "flex gap-3 rounded-lg border p-4",
          onDark ? "border-white/12 bg-white/[0.04]" : "border-ink-200 bg-paper-2",
          className,
        )}
        role="status"
      >
        <CheckCircle2
          className={cn("mt-0.5 size-4.5 shrink-0", onDark ? "text-mint" : "text-mint-deep")}
          aria-hidden
        />
        <div>
          {state.kind === "stored" ? (
            <>
              <p className={cn("text-sm font-medium", onDark ? "text-white" : "text-ink-950")}>
                You are on the list for {state.city}.
              </p>
              <p className={cn("mt-1 text-sm", onDark ? "text-white/55" : "text-ink-600")}>
                One email when it opens. Nothing else, ever.
              </p>
            </>
          ) : (
            <>
              <p className={cn("text-sm font-medium", onDark ? "text-white" : "text-ink-950")}>
                Your address checks out, but the waitlist store is not connected in this
                environment.
              </p>
              <p className={cn("mt-1 text-sm", onDark ? "text-white/55" : "text-ink-600")}>
                Rather than pretend otherwise: email{" "}
                <a
                  href={`mailto:${brand.contact.support}?subject=Waitlist${cityName ? `%20-%20${cityName}` : ""}`}
                  className="font-medium underline underline-offset-4"
                >
                  {brand.contact.support}
                </a>{" "}
                and you will be added by hand.
              </p>
            </>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <form onSubmit={submit} className={cn("w-full", className)} noValidate>
      <label
        htmlFor={fieldId}
        className={cn(
          "block font-mono text-micro uppercase tracking-[0.12em]",
          onDark ? "text-white/45" : "text-ink-400",
        )}
      >
        {cityName ? `Tell me when ${cityName} opens` : "Tell me when my city opens"}
      </label>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Mail
            className={cn(
              "pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2",
              onDark ? "text-white/30" : "text-ink-300",
            )}
            aria-hidden
          />
          <input
            id={fieldId}
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (invalid) setState({ kind: "idle" });
            }}
            placeholder="you@university.edu"
            aria-invalid={invalid}
            aria-describedby={invalid ? `${fieldId}-error` : undefined}
            className={cn(
              "h-11 w-full rounded-full border pr-4 pl-10 text-[0.9375rem] transition-colors",
              onDark
                ? "border-white/15 bg-white/5 text-white placeholder:text-white/30 focus:border-white/40"
                : "border-ink-200 bg-white text-ink-900 placeholder:text-ink-300 focus:border-ink-400",
              invalid && (onDark ? "border-pulse" : "border-pulse-deep"),
              "focus:outline-none",
            )}
          />
        </div>
        <Button
          type="submit"
          variant={onDark ? "signal" : "primary"}
          size="md"
          disabled={state.kind === "sending"}
        >
          {state.kind === "sending" ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Sending
            </>
          ) : (
            "Join the list"
          )}
        </Button>
      </div>

      <AnimatePresence>
        {invalid ? (
          <motion.p
            id={`${fieldId}-error`}
            initial={reduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={cn(
              "mt-2 flex items-center gap-1.5 overflow-hidden text-[0.8125rem]",
              onDark ? "text-pulse" : "text-pulse-deep",
            )}
          >
            <AlertCircle className="size-3.5 shrink-0" aria-hidden />
            {state.message}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </form>
  );
}
