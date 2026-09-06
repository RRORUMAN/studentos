"use client";

import {
  ArrowUp,
  Bookmark,
  Check,
  ExternalLink,
  Loader2,
  MessageSquare,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { AskMeter, Upsell } from "@/components/app/upsell";
import { MascotArt } from "@/components/mascot/mascot-art";
import { Badge } from "@/components/ui/primitives";
import { affordVerdictMeta } from "@/server/engines/afford";
import { askCampus, askStudentOS, type AskResult } from "@/server/actions/ask";
import { savePlanFromAnswer } from "@/server/actions/plans";
import { brand } from "@/brand/brand.config";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * ASK CONSOLE
 * ----------------------------------------------------------------------------
 * The student-life command centre. Not a chat: a question in, cards out.
 *
 *   STUDENTOS SAYS   the plan or list, with prices, a total and sources
 *   STUDENTS SAY     Pulse posts that speak to the question
 *   ASK MY CAMPUS    when neither is enough, post it to real people
 *
 * Every answer is independently reproducible from the query, so nothing
 * depends on a conversation history we would have to store.
 * ============================================================================
 */

export function AskConsole({
  initialQuery,
  initialResult,
  suggestions,
  where,
}: {
  initialQuery: string;
  initialResult: AskResult | null;
  suggestions: readonly string[];
  where: { currency: string; locale: string };
}) {
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<AskResult | null>(initialResult);
  const [asked, setAsked] = useState<string | null>(initialQuery || null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const run = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setAsked(trimmed);
    setQuery(trimmed);
    startTransition(async () => {
      setResult(await askStudentOS(trimmed));
    });
  };

  return (
    <div className="space-y-5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          run(query);
        }}
        className="relative"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="What's free tonight? Where should I eat for €10? Can I afford €35?"
          aria-label={`Ask ${brand.name}`}
          className="h-14 w-full rounded-full bg-white pr-14 pl-5 text-[1rem] text-ink-900 shadow-[var(--shadow-raise)] ring-1 ring-ink-950/8 placeholder:text-ink-400 focus:ring-ink-950/25"
        />
        <button
          type="submit"
          aria-label="Ask"
          disabled={pending || query.trim().length === 0}
          className={cn(
            "absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-full transition-colors",
            query.trim().length === 0 || pending ? "bg-ink-100 text-ink-400" : "bg-ink-950 text-signal hover:bg-ink-800",
          )}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-5" />}
        </button>
      </form>

      {result?.ok ? (
        <AskMeter used={result.usage.used} limit={result.usage.limit} remaining={result.usage.remaining} />
      ) : null}

      {!result && !pending ? (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => run(suggestion)}
              className="rounded-full bg-white px-3.5 py-2 text-[0.875rem] font-medium text-ink-700 ring-1 ring-ink-950/8 transition-colors hover:ring-ink-950/20"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      {pending ? (
        <div className="flex items-center gap-3 rounded-2xl bg-white p-5 ring-1 ring-ink-950/6">
          <MascotArt state="thinking" idle className="size-12 shrink-0" />
          <div>
            <p className="text-[0.9375rem] font-medium text-ink-900">Reading the city.</p>
            <p className="mt-0.5 text-[0.8125rem] text-ink-500">Places, events, prices, and what students reported.</p>
          </div>
        </div>
      ) : null}

      {result && !pending ? (
        result.ok ? (
          <>
            <StudentOSSays result={result} where={where} onRefine={run} asked={asked ?? ""} />
            <StudentsSaySection result={result} asked={asked ?? ""} />
            {result.upsell ? <Upsell feature={result.upsell.feature} line={result.upsell.line} /> : null}
          </>
        ) : (
          <p role="alert" className="rounded-xl bg-pulse-soft px-4 py-3 text-[0.875rem] text-pulse-deep">
            {result.message}
          </p>
        )
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* StudentOS says                                                              */
/* -------------------------------------------------------------------------- */

function StudentOSSays({
  result,
  where,
  onRefine,
  asked,
}: {
  result: Extract<AskResult, { ok: true }>;
  where: { currency: string; locale: string };
  onRefine: (query: string) => void;
  asked: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const { answer, afford } = result;

  if (answer.kind === "empty") {
    return (
      <section className="rounded-2xl bg-white p-5 ring-1 ring-ink-950/6">
        <Eyebrow>StudentOS says</Eyebrow>
        <div className="mt-3 flex items-start gap-4">
          <MascotArt state="empty" className="size-12 shrink-0" />
          <div>
            <h2 className="text-[1.0625rem] font-semibold text-ink-950">{answer.title}</h2>
            <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">{answer.summary}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-raise)] ring-1 ring-ink-950/6">
      <div className="p-5">
        <Eyebrow>StudentOS says</Eyebrow>
        <div className="mt-3 flex items-start gap-4">
          <MascotArt
            state={afford ? (afford.verdict === "yes" ? "neutral" : afford.verdict === "possibly" ? "thinking" : "warning") : answer.totalCents === 0 ? "excited" : "neutral"}
            className="size-12 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[1.125rem] font-semibold text-ink-950">{answer.title}</h2>
              {afford ? <Badge accent={affordVerdictMeta[afford.verdict].accent} tone="solid">{affordVerdictMeta[afford.verdict].label}</Badge> : null}
            </div>
            <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-600">{answer.summary}</p>
            {result.limited ? (
              <p className="mt-2 text-[0.8125rem] text-ink-400">
                Written by the product rather than the model this week — the places and prices are the same.
              </p>
            ) : null}
          </div>
        </div>

        {afford ? (
          <dl className="mt-4 grid grid-cols-3 gap-3">
            <Figure label={`Free until ${afford.horizonLabel}`} value={money(afford.horizonCents / 100, where)} />
            <Figure label="After this" value={money(Math.max(0, afford.leftoverCents) / 100, where)} tone={afford.leftoverCents < 0 ? "bad" : afford.verdict === "yes" ? "good" : "watch"} />
            <Figure label="Per day after" value={money(afford.leftoverPerDayCents / 100, where)} />
          </dl>
        ) : null}

        {afford?.suggestedCents ? (
          <p className="mt-3 text-[0.875rem] text-ink-700">
            A comfortable figure tonight would be about <span className="tnum font-semibold">{money(afford.suggestedCents / 100, where)}</span>.
            The options below fit inside it.
          </p>
        ) : null}
      </div>

      {answer.lines.length > 0 ? (
        <ul className="divide-y divide-ink-100 border-t border-ink-100">
          {answer.lines.map((line, index) => {
            const href = line.refKind === "place" ? `/discover/${line.refId}` : line.refKind === "event" ? `/events/${line.refId}` : null;
            const body = (
              <>
                <span className="tnum w-6 shrink-0 pt-0.5 font-mono text-[0.75rem] text-ink-400">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.9375rem] font-medium text-ink-900">{line.title}</p>
                  <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-500">
                    {line.detail}
                    {line.walkMinutes ? ` · ${line.walkMinutes} min walk` : ""}
                  </p>
                </div>
                <span className={cn("tnum shrink-0 font-mono text-[0.9375rem] font-medium", line.priceCents === 0 ? "text-mint-deep" : "text-ink-900")}>
                  {line.priceCents === 0 ? "Free" : money(line.priceCents / 100, where)}
                </span>
              </>
            );
            return (
              <li key={`${line.title}-${index}`}>
                {href ? (
                  <Link href={href} className="flex items-start gap-3 px-5 py-3.5 hover:bg-paper-2">{body}</Link>
                ) : (
                  <div className="flex items-start gap-3 px-5 py-3.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {answer.kind === "plan" && answer.lines.length > 0 ? (
        <div className="flex items-baseline justify-between border-t border-ink-100 bg-paper-2/60 px-5 py-3.5">
          <span className="font-mono text-micro uppercase tracking-[0.1em] text-ink-500">Total</span>
          <span className="tnum font-mono text-[1.25rem] font-semibold text-ink-950">
            {answer.totalCents === 0 ? "Free" : money(answer.totalCents / 100, where)}
          </span>
        </div>
      ) : null}

      {answer.sources.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 px-5 py-3">
          <span className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">Sources</span>
          {answer.sources.map((source) =>
            source.url ? (
              <a key={source.label} href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2.5 py-1 text-[0.75rem] font-medium text-ink-700 hover:bg-ink-200">
                {source.label}
                <ExternalLink className="size-3" />
              </a>
            ) : (
              <span key={source.label} className="rounded-full bg-ink-100 px-2.5 py-1 text-[0.75rem] font-medium text-ink-600">{source.label}</span>
            ),
          )}
        </div>
      ) : null}

      {/* ---- actions --------------------------------------------------- */}
      {answer.kind === "plan" && answer.lines.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 px-5 py-3.5">
          <button
            type="button"
            disabled={saving || saved !== null}
            onClick={() =>
              startSaving(async () => {
                const saved$ = await savePlanFromAnswer({
                  title: answer.title,
                  query: asked,
                  budgetCents: answer.parsed.budgetCents,
                  lines: answer.lines,
                  forDate: answer.parsed.when === "tonight" ? new Date().toISOString() : null,
                });
                if (saved$.ok) {
                  setSaved(saved$.id);
                  window.setTimeout(() => router.push(`/plans/${saved$.id}`), 500);
                }
              })
            }
            className="inline-flex items-center gap-1.5 rounded-full bg-ink-950 px-3.5 py-2 text-[0.8125rem] font-semibold text-paper hover:bg-ink-800 disabled:opacity-70"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : saved ? <Check className="size-3.5 text-signal" /> : <Bookmark className="size-3.5" />}
            {saved ? "Saved to Plans" : "Save as plan"}
          </button>
          {[
            { label: "Cheaper", query: `${asked} but cheaper` },
            { label: "Free only", query: `${asked} but free` },
            { label: "Less travel", query: `${asked} close by` },
            { label: "More social", query: `${asked} where I can meet people` },
          ].map((refine) => (
            <button
              key={refine.label}
              type="button"
              onClick={() => onRefine(refine.query)}
              className="inline-flex items-center gap-1.5 rounded-full bg-paper-2 px-3 py-1.5 text-[0.8125rem] font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-950"
            >
              <Sparkles className="size-3" />
              {refine.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Students say                                                                */
/* -------------------------------------------------------------------------- */

function StudentsSaySection({ result, asked }: { result: Extract<AskResult, { ok: true }>; asked: string }) {
  const router = useRouter();
  const [posting, startPosting] = useTransition();
  const [posted, setPosted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-ink-950/6">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Students say</Eyebrow>
        <span className="text-[0.75rem] text-ink-400">From Pulse, unedited</span>
      </div>

      {result.students.length === 0 ? (
        <p className="mt-3 text-[0.9375rem] text-ink-600">
          Nobody in your city has posted about this yet. You could be the first to ask.
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {result.students.map((post) => (
            <li key={post.postId}>
              <Link href={`/pulse/${post.postId}`} className="block rounded-xl bg-paper-2 p-3.5 transition-colors hover:bg-ink-100">
                <p className="text-[0.9375rem] font-medium text-ink-900">{post.title}</p>
                {post.topAnswer ? (
                  <p className="mt-1 line-clamp-2 text-[0.875rem] leading-snug text-ink-700">&ldquo;{post.topAnswer}&rdquo;</p>
                ) : post.body ? (
                  <p className="mt-1 line-clamp-2 text-[0.875rem] leading-snug text-ink-700">{post.body}</p>
                ) : null}
                <p className="mt-1.5 flex items-center gap-3 text-[0.75rem] text-ink-500">
                  <span>#{post.channel}</span>
                  <span className="inline-flex items-center gap-1"><MessageSquare className="size-3" />{post.commentCount}</span>
                  <span>{post.upvotes} helpful</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        {posted ? (
          <Link href={`/pulse/${posted}`} className="inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-3.5 py-2 text-[0.8125rem] font-semibold text-mint-deep">
            <Check className="size-3.5" />
            Posted to your campus — open it
          </Link>
        ) : (
          <button
            type="button"
            disabled={posting}
            onClick={() => {
              setError(null);
              startPosting(async () => {
                const outcome = await askCampus(asked);
                if (outcome.ok) {
                  setPosted(outcome.postId);
                  router.refresh();
                } else setError(outcome.message);
              });
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-paper-2 px-3.5 py-2 text-[0.8125rem] font-semibold text-ink-800 transition-colors hover:bg-ink-100"
          >
            {posting ? <Loader2 className="size-3.5 animate-spin" /> : <UsersRound className="size-3.5" />}
            Ask this question to my campus
          </button>
        )}
        {error ? <p role="alert" className="mt-2 text-[0.8125rem] text-pulse-deep">{error}</p> : null}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Bits                                                                        */
/* -------------------------------------------------------------------------- */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">{children}</p>;
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: "good" | "watch" | "bad" }) {
  return (
    <div className="rounded-xl bg-paper-2 p-3">
      <dt className="font-mono text-micro uppercase tracking-[0.08em] text-ink-400">{label}</dt>
      <dd className={cn("tnum mt-1 font-mono text-[1.125rem] font-semibold", tone === "good" ? "text-mint-deep" : tone === "bad" ? "text-pulse-deep" : tone === "watch" ? "text-amber-deep" : "text-ink-950")}>
        {value}
      </dd>
    </div>
  );
}
