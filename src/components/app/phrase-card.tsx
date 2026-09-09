"use client";

import { Bookmark, BookmarkCheck, Check, Info, Volume2, VolumeX } from "lucide-react";
import { useCallback, useState, useSyncExternalStore, useTransition } from "react";

import type { Phrase, PhraseStatus } from "@/domain/language";
import { setPhraseStatus } from "@/server/actions/language";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * PHRASE CARD
 * ----------------------------------------------------------------------------
 * One phrase, and the three things a student does with it: hear it, keep it,
 * or decide they have it.
 *
 * SOUND IS THE DEVICE'S, AND IT SAYS SO WHEN IT IS NOT THERE.
 *
 * There is no recorded audio in this product. Recording a native speaker for
 * four hundred phrases in thirteen languages is a real cost and StudentOS has
 * not paid it, so the play button hands the text to the browser's own speech
 * synthesiser with the pack's BCP-47 tag. That is a genuine implementation
 * with a genuine limit: a device with no Estonian voice installed cannot say
 * an Estonian phrase, and on that device the button is DISABLED and explains
 * why, rather than reading Estonian aloud in an English accent and teaching
 * the student something worse than nothing.
 *
 * Voices load asynchronously in every browser and `getVoices()` is empty on
 * the first call in most of them, so the list is subscribed to rather than
 * read once, and an empty list is treated as "not loaded yet" rather than as
 * "none installed".
 *
 * MARKING A PHRASE KNOWN IS REVERSIBLE and the button says so on the second
 * press. It is the student's own judgement about their own knowledge, not a
 * test result, and a product that will not let them take it back has turned a
 * checkbox into a score.
 * ============================================================================
 */

export function PhraseCard({
  phrase,
  speechTag,
  status,
  compact = false,
}: {
  phrase: Phrase;
  /** The pack's BCP-47 tag, handed to the speech synthesiser. */
  speechTag: string;
  status: PhraseStatus | undefined;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState<PhraseStatus | undefined>(status);
  const voice = useVoiceFor(speechTag);

  const saved = local === "saved";
  const known = local === "known";

  const update = (next: PhraseStatus) => {
    /* Optimistic: the row is the student's own and the write cannot conflict
       with anybody else's. A failed write reverts on the next render. */
    setLocal(next === local ? "seen" : next);
    startTransition(async () => {
      await setPhraseStatus({ phraseId: phrase.id, status: next === local ? "seen" : next });
    });
  };

  return (
    <article
      className={cn(
        "rounded-2xl bg-white ring-1 ring-ink-950/6",
        known ? "ring-mint-deep/30" : null,
        compact ? "p-4" : "p-5",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p
            lang={speechTag}
            className={cn(
              "font-semibold text-ink-950",
              compact ? "text-[1.0625rem]" : "text-[1.25rem] leading-snug sm:text-[1.375rem]",
            )}
          >
            {phrase.text}
          </p>
          <p className="mt-1 text-[0.9375rem] text-ink-600">{phrase.meaning}</p>
          {phrase.say ? (
            <p className="mt-1.5 font-mono text-[0.75rem] uppercase tracking-[0.08em] text-ink-400">
              {phrase.say}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => speak(phrase.text, speechTag)}
          disabled={voice === "missing"}
          aria-label={voice === "missing" ? `No ${speechTag} voice on this device` : `Listen to ${phrase.text}`}
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-950",
            voice === "missing"
              ? "cursor-not-allowed bg-ink-100 text-ink-300"
              : "bg-flow-soft text-flow-deep hover:bg-flow-deep hover:text-white",
          )}
        >
          {voice === "missing" ? <VolumeX className="size-4.5" aria-hidden /> : <Volume2 className="size-4.5" aria-hidden />}
        </button>
      </div>

      {phrase.note ? (
        <p className="mt-3 flex items-start gap-2 border-t border-ink-100 pt-3 text-[0.8125rem] leading-relaxed text-ink-500">
          <Info className="mt-0.5 size-3.5 shrink-0 text-ink-400" aria-hidden />
          <span>{phrase.note}</span>
        </p>
      ) : null}

      {voice === "missing" ? (
        <p className="mt-2 text-[0.75rem] text-ink-400">
          This device has no voice installed for this language, so there is nothing to play.
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => update("saved")}
          disabled={pending}
          aria-pressed={saved}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-950",
            saved ? "bg-ink-950 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200",
          )}
        >
          {saved ? <BookmarkCheck className="size-3.5" aria-hidden /> : <Bookmark className="size-3.5" aria-hidden />}
          {saved ? "Saved" : "Save"}
        </button>

        <button
          type="button"
          onClick={() => update("known")}
          disabled={pending}
          aria-pressed={known}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-950",
            known ? "bg-mint-soft text-mint-deep" : "bg-ink-100 text-ink-700 hover:bg-ink-200",
          )}
        >
          <Check className="size-3.5" aria-hidden />
          {known ? "You know this" : "I know this"}
        </button>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Speech                                                                      */
/* -------------------------------------------------------------------------- */

type VoiceState = "unknown" | "available" | "missing";

/**
 * Whether this device can actually say something in `tag`.
 *
 * Browsers populate `getVoices()` asynchronously and most of them return an
 * empty array on the first synchronous call, so the answer starts as `unknown`
 * -- the button stays enabled -- and is corrected once the list arrives. Being
 * briefly optimistic is right: a working button that turns out to be silent is
 * annoying once, and a disabled button on a device that could have spoken is
 * wrong every time.
 */
function useVoiceFor(tag: string): VoiceState {
  const subscribe = useCallback((onChange: () => void) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return () => {};
    window.speechSynthesis.addEventListener("voiceschanged", onChange);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", onChange);
  }, []);

  const read = useCallback((): VoiceState => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return "missing";
    const voices = window.speechSynthesis.getVoices();
    /* An empty list means "not loaded yet", not "none installed". */
    if (voices.length === 0) return "unknown";
    const language = tag.split("-")[0]?.toLowerCase() ?? tag.toLowerCase();
    return voices.some((option) => option.lang.toLowerCase().startsWith(language))
      ? "available"
      : "missing";
  }, [tag]);

  /* The voice list is an external store that changes on its own schedule, so
     it is subscribed to rather than copied into state. The server snapshot is
     "unknown", which keeps the button enabled through hydration. */
  return useSyncExternalStore(subscribe, read, () => "unknown" as VoiceState);
}

function speak(text: string, tag: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = tag;
  /* A shade slower than natural. The point is to be copied, not to sound fluent. */
  utterance.rate = 0.85;
  const language = tag.split("-")[0]?.toLowerCase() ?? tag.toLowerCase();
  const match = window.speechSynthesis
    .getVoices()
    .find((option) => option.lang.toLowerCase().startsWith(language));
  if (match) utterance.voice = match;
  window.speechSynthesis.speak(utterance);
}
