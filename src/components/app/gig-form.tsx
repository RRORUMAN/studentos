"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useToast } from "@/components/ui/toast";
import {
  type ScheduleTag,
  type SkillKey,
  type WorkKind,
  scheduleLabel,
  scheduleTags,
  skillKeys,
  skillLabel,
  workKindMeta,
} from "@/domain/work";
import { postGig } from "@/server/actions/work";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * POST A GIG
 * ----------------------------------------------------------------------------
 * "I need someone to help me move a sofa on Saturday, €40."
 *
 * The whole form is one screen and takes under a minute, because the thing it
 * competes with is asking in a group chat. Anything longer and the student
 * asks in the group chat.
 *
 * THERE IS NO ADDRESS FIELD. Not an optional one, not a hidden one. `meetArea`
 * takes a public place — a metro station, a campus building, an area name —
 * and the server schema has nowhere else for a location to go. That is the
 * same rule the Exchange runs on and it is worth the friction: a board of
 * students publishing their own front doors is a genuinely dangerous product.
 *
 * The pay field is optional and the copy says what leaving it blank does,
 * rather than pretending everything must have a price. "Tell me what you would
 * charge" is a real way to post a small job.
 * ============================================================================
 */

/* The kinds a student plausibly posts. The full taxonomy is for incoming
   feeds; a picker with twenty-five options is a picker nobody uses. */
const KINDS: readonly WorkKind[] = [
  "ONE_OFF_GIG",
  "MOVING_HELP",
  "TUTORING",
  "LANGUAGE_HELP",
  "PHOTOGRAPHY",
  "DESIGN",
  "CONTENT",
  "CODING",
  "BABYSITTING",
  "PET_SITTING",
  "EVENT_WORK",
  "ADMIN",
  "OTHER",
];

export function GigForm({ currencySymbol }: { currencySymbol: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  const [kind, setKind] = useState<WorkKind>("ONE_OFF_GIG");
  const [schedule, setSchedule] = useState<Set<ScheduleTag>>(new Set());
  const [skills, setSkills] = useState<Set<SkillKey>>(new Set());
  const [period, setPeriod] = useState<"fixed" | "hour">("fixed");
  const [remote, setRemote] = useState<"onsite" | "hybrid" | "remote">("onsite");

  const toggle = <T,>(set: Set<T>, value: T, apply: (next: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    apply(next);
  };

  return (
    <form
      action={(formData) =>
        start(async () => {
          const result = await postGig(formData);
          if (result.ok) {
            toast({ title: result.message ?? "Posted" });
            if (result.id) router.push(`/work/${result.id}`);
          } else {
            toast({ tone: "warning", title: result.message });
          }
        })
      }
      className="mt-6 space-y-5"
    >
      <label className="block">
        <span className="text-[0.9375rem] font-medium text-ink-950">What do you need doing?</span>
        <input
          name="title"
          required
          maxLength={100}
          placeholder="Help me carry a sofa down three floors"
          className="mt-2 w-full rounded-xl bg-white px-3 py-2.5 text-[0.9375rem] text-ink-950 ring-1 ring-ink-950/10 placeholder:text-ink-300"
        />
      </label>

      <label className="block">
        <span className="text-[0.9375rem] font-medium text-ink-950">The detail</span>
        <span className="mt-0.5 block text-[0.8125rem] text-ink-500">
          Enough that somebody can decide whether to say yes without asking three questions first.
        </span>
        <textarea
          name="description"
          required
          rows={4}
          maxLength={1200}
          placeholder="Third floor, no lift, one sofa and two chairs. Twenty minutes if there are two of us. Cash on the day."
          className="mt-2 w-full rounded-xl bg-white px-3 py-2.5 text-[0.9375rem] leading-relaxed text-ink-950 ring-1 ring-ink-950/10 placeholder:text-ink-300"
        />
      </label>

      <div>
        <p className="text-[0.9375rem] font-medium text-ink-950">What kind of work is it?</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {KINDS.map((candidate) => (
            <Pill key={candidate} active={kind === candidate} onClick={() => setKind(candidate)}>
              {workKindMeta[candidate].label}
            </Pill>
          ))}
        </div>
        <input type="hidden" name="kind" value={kind} />
      </div>

      <div>
        <p className="text-[0.9375rem] font-medium text-ink-950">What are you paying?</p>
        <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-500">
          Optional. Leave it blank and the posting says “pay not stated” — which is honest, and gets
          fewer replies than a number does.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[0.9375rem] text-ink-500">{currencySymbol}</span>
          <input
            type="number"
            name="pay"
            min={0}
            step="0.5"
            inputMode="decimal"
            placeholder="40"
            className="tnum w-28 rounded-xl bg-white px-3 py-2 font-mono text-[0.9375rem] text-ink-950 ring-1 ring-ink-950/10"
          />
          <Pill active={period === "fixed"} onClick={() => setPeriod("fixed")}>
            for the job
          </Pill>
          <Pill active={period === "hour"} onClick={() => setPeriod("hour")}>
            per hour
          </Pill>
        </div>
        <input type="hidden" name="payPeriod" value={period} />
      </div>

      <label className="block">
        <span className="text-[0.9375rem] font-medium text-ink-950">Where do you meet?</span>
        <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-ink-500">
          A public place — a metro station, a campus building, an area. There is no address field on
          this form and there never will be.
        </span>
        <input
          name="meetArea"
          required
          maxLength={80}
          placeholder="Argüelles, meet at the metro"
          className="mt-2 w-full rounded-xl bg-white px-3 py-2.5 text-[0.9375rem] text-ink-950 ring-1 ring-ink-950/10 placeholder:text-ink-300"
        />
      </label>

      <div>
        <p className="text-[0.9375rem] font-medium text-ink-950">In person or remote?</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(
            [
              { value: "onsite", label: "In person" },
              { value: "hybrid", label: "Either" },
              { value: "remote", label: "Remote" },
            ] as const
          ).map((option) => (
            <Pill
              key={option.value}
              active={remote === option.value}
              onClick={() => setRemote(option.value)}
            >
              {option.label}
            </Pill>
          ))}
        </div>
        <input type="hidden" name="remote" value={remote} />
      </div>

      <div>
        <p className="text-[0.9375rem] font-medium text-ink-950">When?</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {scheduleTags.map((tag) => (
            <Pill
              key={tag}
              active={schedule.has(tag)}
              onClick={() => toggle(schedule, tag, setSchedule)}
            >
              {scheduleLabel[tag]}
            </Pill>
          ))}
        </div>
        {[...schedule].map((tag) => (
          <input key={tag} type="hidden" name="schedule" value={tag} />
        ))}
      </div>

      <div>
        <p className="text-[0.9375rem] font-medium text-ink-950">What should they be able to do?</p>
        <p className="mt-0.5 text-[0.8125rem] text-ink-500">
          Up to six. This is what decides who sees it.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {skillKeys.map((skill) => (
            <Pill
              key={skill}
              active={skills.has(skill)}
              onClick={() => toggle(skills, skill, setSkills)}
            >
              {skillLabel[skill]}
            </Pill>
          ))}
        </div>
        {[...skills].slice(0, 6).map((skill) => (
          <input key={skill} type="hidden" name="skill" value={skill} />
        ))}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full bg-ink-950 px-5 py-2.5 text-[0.9375rem] font-semibold text-paper transition-colors hover:bg-ink-800 disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Post it
      </button>
    </form>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-[0.875rem] font-medium transition-colors",
        active ? "bg-ink-950 text-paper" : "bg-white text-ink-600 ring-1 ring-ink-950/8 hover:text-ink-950",
      )}
    >
      {children}
    </button>
  );
}
