import { ChevronRight, MessagesSquare, Sparkles } from "lucide-react";
import Link from "next/link";

import { MascotArt } from "@/components/mascot/mascot-art";
import type { CatchUp } from "@/server/engines/catch-up";

/**
 * "Catch me up." What was missed, and the handful of things worth knowing,
 * each linked to the post or the room it came from. Every line is a pointer to
 * something a student wrote, presented as such — never a claim the product is
 * making.
 *
 * The model sentence (paid) sits *above the same links it was written from*,
 * marked as a summary. It is never rendered on its own: a generated line with
 * no source under it is a fact the product cannot stand behind.
 */
export function CatchUpCard({
  catchUp,
  sentence,
}: {
  catchUp: CatchUp;
  /** Optional one-line model summary over the same lines (paid). */
  sentence: string | null;
}) {
  if (catchUp.lines.length === 0) return null;

  return (
    <section aria-labelledby="catch-up-heading" className="rounded-2xl bg-ink-950 p-5 text-paper">
      <div className="flex items-center gap-3">
        <MascotArt state="social" className="size-9 shrink-0" />
        <div className="min-w-0">
          <h2 id="catch-up-heading" className="text-[1.0625rem] font-semibold">
            Catch me up
          </h2>
          <p className="text-[0.8125rem] text-paper/60">
            You missed {catchUp.missedPosts} {catchUp.missedPosts === 1 ? "post" : "posts"}
            {catchUp.missedMessages > 0
              ? ` and ${catchUp.missedMessages} ${catchUp.missedMessages === 1 ? "message" : "messages"}`
              : ""}
            {" → "}
            {catchUp.lines.length} {catchUp.lines.length === 1 ? "thing" : "things"} worth knowing.
          </p>
        </div>
      </div>

      {sentence ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-paper/8 p-3 text-[0.9375rem] leading-snug text-paper/85">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-signal" />
          <span>
            <span className="mr-1.5 font-mono text-micro uppercase tracking-[0.1em] text-paper/45">Summary</span>
            {sentence}
          </span>
        </p>
      ) : null}

      <ol className="mt-4 divide-y divide-paper/10">
        {catchUp.lines.map((line, index) => (
          <li key={`${line.kind}:${line.id}`}>
            <Link
              href={line.href}
              className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-paper/8"
            >
              <span className="tnum w-4 shrink-0 font-mono text-[0.75rem] text-signal">{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] font-medium">{line.title}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[0.75rem] text-paper/55">
                  {line.kind === "channel" ? <MessagesSquare className="size-3" /> : null}
                  #{line.channel} · {line.because}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-paper/40" />
            </Link>
          </li>
        ))}
      </ol>

      <p className="mt-3 text-[0.75rem] text-paper/45">
        Picked by votes, replies and recency. Each line links to the source — read it before you rely on it.
      </p>
    </section>
  );
}
