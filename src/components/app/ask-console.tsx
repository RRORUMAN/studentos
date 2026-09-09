"use client";

import {
  ArrowUp,
  Bookmark,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  History,
  Loader2,
  Languages,
  MapPin,
  MessageSquare,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { AskMeter, Upsell } from "@/components/app/upsell";
import { MascotArt } from "@/components/mascot/mascot-art";
import { Badge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { affordVerdictMeta } from "@/server/engines/afford";
import { askStudentOS, clearAskHistory, type AskResult } from "@/server/actions/ask";
import { askStudents } from "@/server/actions/questions";
import { savePlanFromAnswer } from "@/server/actions/plans";
import type { ToolCard, ToolResult } from "@/server/ai/tools";
import { brand } from "@/brand/brand.config";
import { formatDistance } from "@/domain/places";
import { cn, money } from "@/lib/utils";

/**
 * ============================================================================
 * ASK CONSOLE
 * ----------------------------------------------------------------------------
 * The student-life command centre. Not a chat: a question in, cards out.
 *
 *   UNDERSTOOD       what the question was read as, so it can be corrected
 *   STUDENTOS SAYS   the plan, the list or the figures, with sources
 *   STUDENTS SAY     Pulse posts that speak to the question
 *   NEXT             follow-up questions that parse correctly on their own
 *
 * Every answer is independently reproducible from the query, so nothing
 * depends on a conversation history we would have to store. The question is
 * pushed into the URL, so an answer can be shared, bookmarked and come back
 * after a refresh.
 * ============================================================================
 */

export function AskConsole({
  initialQuery,
  initialResult,
  suggestions,
  history,
  where,
}: {
  initialQuery: string;
  initialResult: AskResult | null;
  suggestions: readonly string[];
  history: readonly { id: string; query: string; summary: string }[];
  where: { currency: string; locale: string };
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<AskResult | null>(initialResult);
  const [asked, setAsked] = useState<string | null>(initialQuery || null);
  const [pending, startTransition] = useTransition();
  const [showHistory, setShowHistory] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);

  const run = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setAsked(trimmed);
    setQuery(trimmed);
    setShowHistory(false);
    /* Put the question in the URL so the answer is linkable and survives a
       refresh. `replace` rather than `push`: a refinement is a correction of
       the same question, not a new page in the back stack. */
    window.history.replaceState(null, "", `/ask?q=${encodeURIComponent(trimmed)}`);
    startTransition(async () => {
      setResult(await askStudentOS(trimmed));
    });
  };

  /* Scroll the answer into view after a refinement on a phone, where the new
     cards would otherwise land below the fold. */
  useEffect(() => {
    if (result && asked && window.scrollY > 240) {
      answerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  return (
    <div className="space-y-5">
      {/* ---- the box ---------------------------------------------------- */}
      <div className="sticky top-14 z-30 -mx-5 bg-paper/95 px-5 py-3 backdrop-blur-md lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            run(query);
          }}
          className="relative"
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="What's free tonight? Where should I eat for €10?"
            aria-label={`Ask ${brand.name}`}
            className="h-14 w-full rounded-full bg-white pr-24 pl-5 text-[1rem] text-ink-900 shadow-[var(--shadow-raise)] ring-1 ring-ink-950/8 placeholder:text-ink-400 focus:ring-ink-950/25"
          />
          <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
            {history.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowHistory((open) => !open)}
                aria-expanded={showHistory}
                aria-label="Recent questions"
                className="grid size-9 place-items-center rounded-full text-ink-400 transition-colors hover:bg-paper-2 hover:text-ink-900"
              >
                <History className="size-4" />
              </button>
            ) : null}
            <button
              type="submit"
              aria-label="Ask"
              disabled={pending || query.trim().length === 0}
              className={cn(
                "grid size-10 place-items-center rounded-full transition-colors",
                query.trim().length === 0 || pending ? "bg-ink-100 text-ink-400" : "bg-ink-950 text-signal hover:bg-ink-800",
              )}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-5" />}
            </button>
          </div>
        </form>

        {showHistory && history.length > 0 ? (
          <div className="mt-2 overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-float)] ring-1 ring-ink-950/8">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">Recent</span>
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    await clearAskHistory();
                    setShowHistory(false);
                    router.refresh();
                  })
                }
                className="text-[0.75rem] font-medium text-ink-500 hover:text-pulse-deep"
              >
                Clear
              </button>
            </div>
            <ul className="divide-y divide-ink-100 border-t border-ink-100">
              {history.map((entry) => (
                <li key={entry.id}>
                  <button type="button" onClick={() => run(entry.query)} className="flex w-full items-start gap-2 px-4 py-2.5 text-left hover:bg-paper-2">
                    <Clock className="mt-0.5 size-3.5 shrink-0 text-ink-300" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.875rem] text-ink-900">{entry.query}</span>
                      <span className="mt-0.5 block truncate text-[0.75rem] text-ink-400">{entry.summary}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {result?.ok ? <AskMeter used={result.usage.used} limit={result.usage.limit} remaining={result.usage.remaining} /> : null}

      {!result && !pending ? (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar edge-fade-x sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none]">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => run(suggestion)}
              className="shrink-0 rounded-full bg-white px-3.5 py-2 text-[0.875rem] font-medium text-ink-700 ring-1 ring-ink-950/8 transition-colors hover:ring-ink-950/20"
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
            <p className="mt-0.5 text-[0.8125rem] text-ink-500">Places, events, prices, your budget, and what students reported.</p>
          </div>
        </div>
      ) : null}

      <div ref={answerRef}>
        {result && !pending ? (
          result.ok ? (
            <div className="space-y-5">
              <StudentOSSays result={result} where={where} onAsk={run} />
              <ToolCards tools={result.tools} where={where} />
              <StudentsSaySection result={result} asked={asked ?? ""} />
              <NextQuestions items={result.followUps} onAsk={run} />
              {result.upsell ? <Upsell feature={result.upsell.feature} line={result.upsell.line} /> : null}
            </div>
          ) : (
            <p role="alert" className="rounded-xl bg-pulse-soft px-4 py-3 text-[0.875rem] text-pulse-deep">
              {result.message}
            </p>
          )
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* StudentOS says                                                              */
/* -------------------------------------------------------------------------- */

function StudentOSSays({
  result,
  where,
  onAsk,
}: {
  result: Extract<AskResult, { ok: true }>;
  where: { currency: string; locale: string };
  onAsk: (query: string) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const { answer, afford } = result;
  const figures = result.tools.flatMap((tool) => tool.figures ?? []);

  if (answer.kind === "empty") {
    return (
      <section className="rounded-2xl bg-white p-5 ring-1 ring-ink-950/6">
        <Understood text={result.understood} />
        <div className="mt-3 flex items-start gap-4">
          <MascotArt state="empty" className="size-12 shrink-0" />
          <div>
            <h2 className="text-[1.0625rem] font-semibold text-ink-950">{answer.title}</h2>
            <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-600">{answer.summary}</p>
          </div>
        </div>
        <div className="mt-4">
          <Actions result={result} onAsk={onAsk} saved={saved} saving={saving} onSave={() => undefined} />
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="answer-heading"
      className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-raise)] ring-1 ring-ink-950/6"
    >
      <div className="p-5">
        <Understood text={result.understood} />
        <div className="mt-3 flex items-start gap-4">
          <MascotArt
            state={afford ? (afford.verdict === "yes" ? "budget" : afford.verdict === "possibly" ? "thinking" : "concerned") : answer.cost.totalCents === 0 && answer.cost.estimateHighCents === 0 ? "excited" : "neutral"}
            className="size-12 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="answer-heading" className="text-[1.125rem] font-semibold text-ink-950">
                {answer.title}
              </h2>
              {afford ? <Badge accent={affordVerdictMeta[afford.verdict].accent} tone="solid">{affordVerdictMeta[afford.verdict].label}</Badge> : null}
            </div>
            <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-600">{answer.summary}</p>
            {result.note ? <p className="mt-2 text-[0.8125rem] text-ink-400">{result.note}</p> : null}
          </div>
        </div>

        {figures.length > 0 ? (
          <dl className={cn("mt-4 grid gap-3", figures.length >= 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2")}>
            {figures.slice(0, 6).map((figure) => (
              <Figure key={figure.label} label={figure.label} value={figure.value} tone={figure.tone} />
            ))}
          </dl>
        ) : null}

        {afford?.suggestedCents ? (
          <p className="mt-3 text-[0.875rem] text-ink-700">
            A comfortable figure would be about <span className="tnum font-semibold">{money(afford.suggestedCents / 100, where)}</span>. The options below fit inside it.
          </p>
        ) : null}
      </div>

      {answer.lines.length > 0 ? (
        <ul className="divide-y divide-ink-100 border-t border-ink-100">
          {answer.lines.map((line, index) => {
            const href = line.refKind === "place" ? `/discover/${encodeURIComponent(line.refId ?? "")}` : line.refKind === "event" ? `/events/${line.refId}` : null;
            const body = (
              <>
                <span className="tnum w-6 shrink-0 pt-0.5 font-mono text-[0.75rem] text-ink-400">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.9375rem] font-medium text-ink-900">{line.title}</p>
                  <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-500">
                    {line.detail}
                    {line.metres !== null ? ` · ${formatDistance(line.metres)} away` : ""}
                  </p>
                </div>
                {/* Three states, and they are different claims. A published
                    price is money. An estimate is a range with its basis in
                    the tooltip. Neither means the row says nothing about
                    price, and it renders as that rather than as "Free". */}
                <span
                  className={cn(
                    "tnum shrink-0 font-mono text-[0.9375rem] font-medium",
                    line.priceCents === 0 ? "text-mint-deep" : "text-ink-900",
                  )}
                  title={
                    line.estimateBasis === "city-anchor"
                      ? "Estimated from this city's typical student prices, not from a menu."
                      : undefined
                  }
                >
                  {line.priceCents !== null
                    ? line.priceCents === 0
                      ? "Free"
                      : money(line.priceCents / 100, where)
                    : line.estimateCents
                      ? `≈ ${money(line.estimateCents[0] / 100, where)}–${money(line.estimateCents[1] / 100, where)}`
                      : "Not listed"}
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
        <div className="flex items-baseline justify-between gap-4 border-t border-ink-100 bg-paper-2/60 px-5 py-3.5">
          <span className="font-mono text-micro uppercase tracking-[0.1em] text-ink-500">
            {answer.cost.estimateHighCents > 0 ? "Booked" : "Total"}
          </span>
          <span className="text-right">
            <span className="tnum block font-mono text-[1.25rem] font-semibold text-ink-950">
              {answer.cost.totalCents === 0 && answer.cost.estimateHighCents === 0
                ? "Free"
                : money(answer.cost.totalCents / 100, where)}
            </span>
            {/* The estimate is stated separately and always labelled. Adding
                it into the figure above would make a guess look like a total. */}
            {answer.cost.estimateHighCents > 0 ? (
              <span className="tnum mt-0.5 block text-[0.8125rem] text-ink-500">
                plus about {money(answer.cost.estimateLowCents / 100, where)}–
                {money(answer.cost.estimateHighCents / 100, where)} estimated
              </span>
            ) : null}
            {answer.cost.unpricedLines > 0 ? (
              <span className="mt-0.5 block text-[0.8125rem] text-ink-400">
                {answer.cost.unpricedLines} with no published price
              </span>
            ) : null}
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

      <div className="border-t border-ink-100 px-5 py-3.5">
        <Actions
          result={result}
          onAsk={onAsk}
          saved={saved}
          saving={saving}
          onSave={() =>
            startSaving(async () => {
              const outcome = await savePlanFromAnswer({
                title: answer.title,
                query: result.query,
                budgetCents: answer.parsed.budgetCents,
                lines: answer.lines,
                forDate: answer.parsed.when === "tonight" ? new Date().toISOString() : null,
              });
              if (outcome.ok) {
                setSaved(outcome.id);
                toast({ title: "Saved to Plans.", description: "Open it to invite people or vote on the stops." });
                router.refresh();
              } else {
                toast({ title: outcome.message, tone: "warning" });
              }
            })
          }
        />
      </div>
    </section>
  );
}

function Actions({
  result,
  onAsk,
  saved,
  saving,
  onSave,
}: {
  result: Extract<AskResult, { ok: true }>;
  onAsk: (query: string) => void;
  saved: string | null;
  saving: boolean;
  onSave: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [posting, startPosting] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {result.actions.map((action) => {
        if (action.kind === "save-plan") {
          return saved ? (
            <Link key="saved" href={`/plans/${saved}`} className="inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-3.5 py-2 text-[0.8125rem] font-semibold text-mint-deep">
              <Check className="size-3.5" />
              Saved — open it
            </Link>
          ) : (
            <button
              key="save"
              type="button"
              disabled={saving}
              onClick={onSave}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink-950 px-3.5 py-2 text-[0.8125rem] font-semibold text-paper hover:bg-ink-800 disabled:opacity-70"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Bookmark className="size-3.5" />}
              Save as plan
            </button>
          );
        }
        if (action.kind === "open") {
          return (
            <Link
              key={action.href}
              href={action.href}
              className="inline-flex items-center gap-1.5 rounded-full bg-paper-2 px-3.5 py-2 text-[0.8125rem] font-medium text-ink-800 transition-colors hover:bg-ink-100"
            >
              {action.label}
              <ChevronRight className="size-3.5" />
            </Link>
          );
        }
        return (
          <button
            key="ask-campus"
            type="button"
            disabled={posting}
            onClick={() =>
              startPosting(async () => {
                /* The structured Ask Students loop, not a forum post: this
                   routes to the smallest audience that plausibly knows,
                   notifies the asker when somebody answers, and — once two
                   students agree — becomes a claim the next person who asks
                   gets straight away. See `domain/questions.ts`. */
                const outcome = await askStudents({
                  title: result.query,
                  originQuery: result.query,
                });
                if (outcome.ok) {
                  toast({
                    title: "Asked your campus.",
                    description: "We'll tell you as soon as somebody answers.",
                  });
                  router.push(`/ask/questions/${outcome.questionId}`);
                } else {
                  toast({ title: outcome.message, tone: "warning" });
                }
              })
            }
            className="inline-flex items-center gap-1.5 rounded-full bg-paper-2 px-3.5 py-2 text-[0.8125rem] font-medium text-ink-800 transition-colors hover:bg-ink-100"
          >
            {posting ? <Loader2 className="size-3.5 animate-spin" /> : <UsersRound className="size-3.5" />}
            Ask my campus
          </button>
        );
      })}
      {void onAsk}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tool cards                                                                  */
/* -------------------------------------------------------------------------- */

const CARD_ICON: Record<ToolCard["kind"], typeof MapPin> = {
  place: MapPin,
  event: Clock,
  deal: Sparkles,
  invite: UsersRound,
  post: MessageSquare,
  listing: Bookmark,
  task: Check,
  mission: Sparkles,
  person: UsersRound,
  figure: Sparkles,
  phrase: Languages,
};

const TOOL_HEADING: Record<string, string> = {
  search_places: "Places",
  search_events: "What is on",
  search_deals: "Deals",
  search_student_pulse: "From Pulse",
  search_exchange: "On the exchange",
  search_social: "People and plans",
  read_lifeops: "On your timeline",
  read_saved: "You saved these",
  suggest_missions: "Missions that fit",
  get_useful_phrases: "What to say",
};

/**
 * The extra rows the tools produced that are not in the main answer — deals
 * alongside a food list, people alongside an event list. Rendered as cards
 * rather than folded into prose, which is the whole point of the tool layer.
 */
function ToolCards({ tools, where }: { tools: readonly ToolResult[]; where: { currency: string; locale: string } }) {
  const extra = tools.filter((tool) => tool.cards.length > 0 && TOOL_HEADING[tool.tool] && tool.tool !== "search_places" && tool.tool !== "search_events");
  if (extra.length === 0) return null;

  return (
    <>
      {extra.map((tool) => (
        <section key={tool.tool} className="rounded-2xl bg-white p-5 ring-1 ring-ink-950/6">
          <h3 className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">{TOOL_HEADING[tool.tool]}</h3>
          <ul className="mt-3 space-y-2">
            {tool.cards.slice(0, 4).map((card) => {
              const Icon = CARD_ICON[card.kind];
              const body = (
                <>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-paper-2 text-ink-500">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-medium text-ink-900">{card.title}</span>
                    <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-500">{card.detail}</span>
                    {card.reasons.length > 0 ? (
                      <span className="mt-0.5 block truncate text-[0.75rem] text-ink-400">{card.reasons.slice(0, 2).join(" · ")}</span>
                    ) : null}
                  </span>
                  {card.priceCents !== null ? (
                    <span className={cn("tnum shrink-0 font-mono text-[0.875rem] font-medium", card.priceCents === 0 ? "text-mint-deep" : "text-ink-900")}>
                      {card.priceCents === 0 ? "Free" : money(card.priceCents / 100, where)}
                    </span>
                  ) : null}
                </>
              );
              return (
                <li key={card.id}>
                  {card.href ? (
                    <Link href={card.href} className="flex items-center gap-3 rounded-xl bg-paper-2/60 p-3 transition-colors hover:bg-paper-2">{body}</Link>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl bg-paper-2/60 p-3">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Students say                                                                */
/* -------------------------------------------------------------------------- */

function StudentsSaySection({ result, asked }: { result: Extract<AskResult, { ok: true }>; asked: string }) {
  if (result.students.length === 0) return null;
  void asked;

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-ink-950/6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">Students say</h3>
        <span className="text-[0.75rem] text-ink-400">From Pulse, unedited</span>
      </div>

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
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Next                                                                        */
/* -------------------------------------------------------------------------- */

function NextQuestions({ items, onAsk }: { items: readonly { label: string; query: string }[]; onAsk: (query: string) => void }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 px-1 font-mono text-micro uppercase tracking-[0.12em] text-ink-400">Next</h3>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar edge-fade-x sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none]">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onAsk(item.query)}
            title={item.query}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[0.8125rem] font-medium text-ink-700 ring-1 ring-ink-950/8 transition-colors hover:ring-ink-950/20"
          >
            <Sparkles className="size-3 text-ink-400" />
            {item.label}
          </button>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Bits                                                                        */
/* -------------------------------------------------------------------------- */

/** What the question was read as. Visible so a misread can be corrected. */
function Understood({ text }: { text: string }) {
  return (
    <p className="flex flex-wrap items-center gap-1.5 font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
      <span>Read as</span>
      <span className="rounded-full bg-paper-2 px-2 py-0.5 text-ink-600 normal-case tracking-normal">{text}</span>
    </p>
  );
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

export { X as AskCloseIcon };
