"use client";

import {
  AlarmClock,
  CalendarPlus,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { useToast } from "@/components/ui/toast";
import { MascotArt } from "@/components/mascot/mascot-art";
import {
  type LifeOpsItem,
  type LifeOpsItemKind,
  type LifeOpsTaskKind,
  lifeOpsKindMeta,
  snoozePresets,
  type SnoozePreset,
} from "@/domain/lifeops";
import {
  completeLifeOpsItem,
  createLifeOpsTask,
  dismissLifeOpsItem,
  rescheduleLifeOpsItem,
  restoreLifeOpsItem,
  snoozeLifeOpsItem,
} from "@/server/actions/lifeops";
import { cn } from "@/lib/utils";
import { useDialog } from "@/components/ui/use-dialog";

/**
 * ============================================================================
 * LIFEOPS TIMELINE
 * ----------------------------------------------------------------------------
 * The rows, grouped by day, with the four things a student does to a row:
 * tick it, push it, put it in a calendar, or make it go away. Every action is
 * a server action with a toast and, where it makes sense, an undo.
 *
 * All time labels arrive pre-formatted from the server in the city's zone, so
 * nothing here calls `toLocale…` and nothing hydrates differently.
 * ============================================================================
 */

export type TimelineRow = LifeOpsItem & {
  timeLabel: string | null;
  dayLabel: string | null;
  priceLabel: string | null;
  googleUrl: string | null;
};

export type TimelineGroup = { key: string; label: string; items: TimelineRow[] };

const KIND_ACCENT: Record<LifeOpsItemKind, string> = {
  task: "bg-flow-soft text-flow-deep",
  deadline: "bg-pulse-soft text-pulse-deep",
  class: "bg-flow-soft text-flow-deep",
  reminder: "bg-amber-soft text-amber-deep",
  event: "bg-pulse-soft text-pulse-deep",
  invite: "bg-signal-soft text-signal-deep",
  plan: "bg-signal-soft text-signal-deep",
  payment: "bg-amber-soft text-amber-deep",
  mission: "bg-mint-soft text-mint-deep",
  travel: "bg-flow-soft text-flow-deep",
  social: "bg-signal-soft text-signal-deep",
};

export function LifeOpsTimeline({
  groups,
  overdue,
  emptyLine,
  suggestions,
  defaultKind = "task",
}: {
  groups: readonly TimelineGroup[];
  overdue: readonly TimelineRow[];
  emptyLine: string;
  suggestions: readonly { title: string; kind: LifeOpsTaskKind; inDays: number }[];
  defaultKind?: LifeOpsTaskKind;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ title: string; kind: LifeOpsTaskKind; inDays: number } | null>(null);
  const total = overdue.length + groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className="space-y-6">
      {overdue.length > 0 ? (
        <section aria-labelledby="overdue-heading" className="rounded-2xl bg-pulse-soft/50 p-4 ring-1 ring-pulse-deep/15">
          <h2 id="overdue-heading" className="flex items-center gap-2 text-[0.9375rem] font-semibold text-pulse-deep">
            <AlarmClock className="size-4" />
            Slipped
          </h2>
          <ul className="mt-2 divide-y divide-pulse-deep/10">
            {overdue.map((item) => (
              <Row key={item.key} item={item} />
            ))}
          </ul>
        </section>
      ) : null}

      {total === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-white px-5 py-10 text-center ring-1 ring-ink-950/6">
          <MascotArt state="neutral" className="size-16" />
          <p className="mt-4 max-w-sm text-[0.9375rem] text-ink-700">{emptyLine}</p>
        </div>
      ) : null}

      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`group-${group.key}`}>
          <h2 id={`group-${group.key}`} className="mb-2 px-1 font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
            {group.label}
          </h2>
          <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
            {group.items.map((item) => (
              <Row key={item.key} item={item} />
            ))}
          </ul>
        </section>
      ))}

      {/* ---- quick add ------------------------------------------------- */}
      <section aria-labelledby="add-heading">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft(null);
              setAdding(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-ink-950 pr-4 pl-3 text-[0.875rem] font-semibold text-paper hover:bg-ink-800"
          >
            <Plus className="size-4" />
            Add to my timeline
          </button>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.title}
              type="button"
              onClick={() => {
                setDraft(suggestion);
                setAdding(true);
              }}
              className="inline-flex h-9 items-center rounded-full bg-white px-3.5 text-[0.8125rem] font-medium text-ink-600 ring-1 ring-ink-950/8 hover:ring-ink-950/20"
            >
              {suggestion.title}
            </button>
          ))}
        </div>
        <h2 id="add-heading" className="sr-only">Add a task</h2>
      </section>

      {adding ? (
        <AddSheet
          initial={draft ?? { title: "", kind: defaultKind, inDays: 0 }}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Row                                                                         */
/* -------------------------------------------------------------------------- */

function Row({ item }: { item: TimelineRow }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [menu, setMenu] = useState(false);
  const [done, setDone] = useState(false);
  const canComplete = item.actions.includes("complete");
  const meta = lifeOpsKindMeta[item.kind];

  const act = (run: () => Promise<{ ok: boolean; message: string; undo?: { key: string } }>) => {
    setMenu(false);
    startTransition(async () => {
      const result = await run();
      if (!result.ok) {
        setDone(false);
        toast({ title: result.message, tone: "warning" });
        return;
      }
      toast({
        title: result.message,
        description: result.undo ? "Undo from the timeline in the next minute." : undefined,
      });
      router.refresh();
    });
  };

  return (
    <li className={cn("flex items-start gap-3 px-4 py-3.5", done && "bg-paper-2/60")}>
      {canComplete ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `Mark "${item.title}" not done` : `Mark "${item.title}" done`}
          disabled={pending}
          onClick={() => {
            setDone(true);
            act(() => completeLifeOpsItem(item.key, { title: item.title }));
          }}
          className={cn(
            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
            done ? "border-ink-950 bg-ink-950" : "border-ink-300 bg-white hover:border-ink-500",
          )}
        >
          {pending ? <Loader2 className="size-3 animate-spin text-ink-400" /> : done ? <Check className="size-3 text-signal" strokeWidth={3} /> : null}
        </button>
      ) : (
        <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[0.625rem]", KIND_ACCENT[item.kind])} aria-hidden>
          {item.kind === "event" ? "🎟" : item.kind === "invite" ? "👋" : item.kind === "plan" ? "🗺" : item.kind === "mission" ? "🎯" : "•"}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          {item.timeLabel ? (
            <span className="tnum shrink-0 font-mono text-[0.8125rem] text-ink-500">{item.timeLabel}</span>
          ) : null}
          {item.href ? (
            <Link href={item.href} className={cn("min-w-0 truncate text-[0.9375rem] font-medium hover:underline", done ? "text-ink-400 line-through" : "text-ink-900")}>
              {item.title}
            </Link>
          ) : (
            <span className={cn("min-w-0 truncate text-[0.9375rem] font-medium", done ? "text-ink-400 line-through" : "text-ink-900")}>{item.title}</span>
          )}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8125rem] text-ink-500">
          <span className={cn("rounded-full px-1.5 py-px text-[0.6875rem] font-semibold", KIND_ACCENT[item.kind])}>{meta.label}</span>
          {item.meta ? <span className="min-w-0 truncate">{item.meta}</span> : null}
          {item.social ? <span className="font-medium text-ink-700">{item.social}</span> : null}
          {item.unblocks > 0 ? <span className="rounded-full bg-flow-soft px-1.5 py-px text-[0.6875rem] font-semibold text-flow-deep">Unblocks {item.unblocks}</span> : null}
          {item.snoozed ? <span className="inline-flex items-center gap-1 text-ink-400"><Clock className="size-3" /> snoozed</span> : null}
          {item.official ? <span className="rounded-full bg-mint-soft px-1.5 py-px text-[0.6875rem] font-semibold text-mint-deep">Official source</span> : null}
        </p>
      </div>

      {item.priceLabel ? (
        <span className={cn("tnum shrink-0 pt-0.5 font-mono text-[0.875rem] font-medium", item.priceCents === 0 ? "text-mint-deep" : "text-ink-900")}>{item.priceLabel}</span>
      ) : null}

      {item.actions.length > 0 ? (
        <div className="relative shrink-0">
          <button
            type="button"
            aria-label={`More for "${item.title}"`}
            aria-expanded={menu}
            onClick={() => setMenu((open) => !open)}
            className="grid size-8 place-items-center rounded-full text-ink-400 hover:bg-paper-2 hover:text-ink-900"
          >
            <MoreHorizontal className="size-4" />
          </button>
          {menu ? <Menu item={item} onClose={() => setMenu(false)} act={act} /> : null}
        </div>
      ) : item.href ? (
        <Link href={item.href} aria-label={`Open ${item.title}`} className="grid size-8 shrink-0 place-items-center rounded-full text-ink-300 hover:text-ink-900">
          <ChevronRight className="size-4" />
        </Link>
      ) : null}
    </li>
  );
}

function Menu({
  item,
  onClose,
  act,
}: {
  item: TimelineRow;
  onClose: () => void;
  act: (run: () => Promise<{ ok: boolean; message: string; undo?: { key: string } }>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [reschedule, setReschedule] = useState(false);
  const [when, setWhen] = useState("");
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [onClose]);

  const undoable = (run: () => Promise<{ ok: boolean; message: string; undo?: { key: string } }>) =>
    act(async () => {
      const result = await run();
      if (result.ok && result.undo) {
        window.setTimeout(() => undefined, 0);
      }
      return result;
    });

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute top-9 right-0 z-30 w-60 overflow-hidden rounded-xl bg-white p-1.5 shadow-[var(--shadow-float)] ring-1 ring-ink-950/8"
    >
      {item.actions.includes("snooze") ? (
        <div className="px-2 pt-1.5 pb-1">
          <p className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">Snooze</p>
          <div className="mt-1.5 grid grid-cols-2 gap-1">
            {snoozePresets.map((preset) => (
              <button
                key={preset.key}
                type="button"
                role="menuitem"
                onClick={() => undoable(() => snoozeLifeOpsItem(item.key, preset.key as SnoozePreset, item.title))}
                className="rounded-lg bg-paper-2 px-2 py-1.5 text-left text-[0.8125rem] font-medium text-ink-700 hover:bg-ink-100"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {item.actions.includes("reschedule") ? (
        <div className="px-2 py-1.5">
          {reschedule ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!when) return;
                act(() => rescheduleLifeOpsItem(item.key, new Date(when).toISOString(), false));
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="datetime-local"
                value={when}
                onChange={(event) => setWhen(event.target.value)}
                aria-label="New date and time"
                className="h-8 min-w-0 flex-1 rounded-md border border-ink-200 px-2 text-[0.8125rem]"
              />
              <button type="submit" className="h-8 rounded-md bg-ink-950 px-2.5 text-[0.75rem] font-semibold text-paper">Move</button>
            </form>
          ) : (
            <button type="button" role="menuitem" onClick={() => setReschedule(true)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[0.8125rem] font-medium text-ink-700 hover:bg-paper-2">
              <Clock className="size-3.5 text-ink-400" />
              Reschedule
            </button>
          )}
        </div>
      ) : null}

      {item.actions.includes("calendar") && item.googleUrl ? (
        <div className="px-2 py-1">
          <a href={item.googleUrl} target="_blank" rel="noopener noreferrer" role="menuitem" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[0.8125rem] font-medium text-ink-700 hover:bg-paper-2">
            <CalendarPlus className="size-3.5 text-ink-400" />
            Google Calendar
            <ExternalLink className="ml-auto size-3 text-ink-300" />
          </a>
          <a href={`/api/lifeops/calendar.ics?key=${encodeURIComponent(item.key)}`} role="menuitem" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[0.8125rem] font-medium text-ink-700 hover:bg-paper-2">
            <CalendarPlus className="size-3.5 text-ink-400" />
            Download .ics
          </a>
        </div>
      ) : null}

      {item.actions.includes("dismiss") ? (
        <div className="border-t border-ink-100 px-2 pt-1.5 pb-1">
          <button
            type="button"
            role="menuitem"
            onClick={() =>
              act(async () => {
                const result = await dismissLifeOpsItem(item.key, item.title);
                if (result.ok) {
                  toast({
                    title: "Removed from your timeline.",
                    description: "Changed your mind? Restore it from the row that just disappeared — or just re-add it.",
                  });
                  window.setTimeout(async () => undefined, 0);
                  void router;
                }
                return result;
              })
            }
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[0.8125rem] font-medium text-pulse-deep hover:bg-pulse-soft/60"
          >
            <Trash2 className="size-3.5" />
            Remove from timeline
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Undo helper exposed for toasts                                              */
/* -------------------------------------------------------------------------- */

export function UndoButton({ itemKey, label = "Undo" }: { itemKey: string; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await restoreLifeOpsItem(itemKey);
          router.refresh();
        })
      }
      className="text-[0.8125rem] font-semibold underline underline-offset-4"
    >
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Add sheet                                                                   */
/* -------------------------------------------------------------------------- */

const KINDS: { key: LifeOpsTaskKind; label: string }[] = [
  { key: "task", label: "Task" },
  { key: "deadline", label: "Deadline" },
  { key: "class", label: "Class" },
  { key: "payment", label: "Payment" },
  { key: "reminder", label: "Reminder" },
  { key: "travel", label: "Travel" },
  { key: "social", label: "Social" },
];

function localInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function AddSheet({
  initial,
  onClose,
}: {
  initial: { title: string; kind: LifeOpsTaskKind; inDays: number };
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(initial.title);
  const [kind, setKind] = useState<LifeOpsTaskKind>(initial.kind);
  const [when, setWhen] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + initial.inDays);
    date.setHours(initial.kind === "class" ? 10 : 12, 0, 0, 0);
    return localInput(date);
  });
  const [allDay, setAllDay] = useState(initial.kind !== "class");
  const [weekly, setWeekly] = useState(initial.kind === "class");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  /* `aria-modal` claims nothing behind this is reachable; the trap is what
     makes that true. See components/ui/use-dialog.ts. */
  const dialogRef = useDialog(true);

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center bg-ink-950/40 sm:items-center" onClick={onClose}>
      <form
        ref={dialogRef as React.RefObject<HTMLFormElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-task-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          start(async () => {
            const result = await createLifeOpsTask({
              title,
              kind,
              dueAt: when ? new Date(when).toISOString() : null,
              allDay,
              repeat: weekly ? "weekly" : null,
            });
            if (!result.ok) {
              setError(result.message);
              return;
            }
            toast({ title: "Added to your timeline." });
            router.refresh();
            onClose();
          });
        }}
        className="w-full max-w-lg rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-lift)] sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="add-task-title" className="text-[1.0625rem] font-semibold text-ink-950">Add to my timeline</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full text-ink-400 hover:bg-paper-2">
            <X className="size-4" />
          </button>
        </div>

        <label className="mt-4 block">
          <span className="sr-only">What</span>
          <input
            ref={inputRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Assignment due, rent, gym, call home…"
            className="h-12 w-full rounded-xl border border-ink-200 bg-paper px-4 text-[1rem] text-ink-900 placeholder:text-ink-400 focus:border-ink-400"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {KINDS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              aria-pressed={kind === entry.key}
              onClick={() => {
                setKind(entry.key);
                if (entry.key === "class") {
                  setAllDay(false);
                  setWeekly(true);
                }
              }}
              className={cn(
                "h-8 rounded-full px-3 text-[0.8125rem] font-medium transition-colors",
                kind === entry.key ? "bg-ink-950 text-paper" : "bg-paper-2 text-ink-600 hover:bg-ink-100",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="mb-1 block text-[0.8125rem] font-medium text-ink-700">When</span>
            <input
              type="datetime-local"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
              className="h-11 w-full rounded-lg border border-ink-200 bg-white px-3 text-[0.9375rem] text-ink-900"
            />
          </label>
          <div className="flex items-end gap-4 pb-2.5 text-[0.8125rem] text-ink-700">
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} className="size-4 rounded border-ink-300" />
              All day
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked={weekly} onChange={(event) => setWeekly(event.target.checked)} className="size-4 rounded border-ink-300" />
              Every week
            </label>
          </div>
        </div>

        {error ? <p role="alert" className="mt-3 text-[0.8125rem] text-pulse-deep">{error}</p> : null}

        <button
          type="submit"
          disabled={pending || title.trim().length === 0}
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink-950 text-[0.9375rem] font-semibold text-paper disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add
        </button>
      </form>
    </div>
  );
}
