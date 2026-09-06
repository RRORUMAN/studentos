import type { Metadata } from "next";

import { Mascot, MascotAvatar, MascotSay } from "@/components/mascot/mascot";
import { MascotArt } from "@/components/mascot/mascot-art";
import { MascotReaction, SheetSticker, stickerSheet } from "@/components/viral/sticker";
import {
  DoodleBubble,
  DoodleCoin,
  DoodlePin,
  DoodleRoute,
  DoodleStar,
  DoodleTag,
} from "@/components/brand/doodles";
import { PageHero } from "@/components/layout/page-hero";
import { Eyebrow, Section } from "@/components/ui/primitives";
import { brand } from "@/brand/brand.config";
import {
  mascot,
  mascotAlt,
  mascotLines,
  mascotStateGuide,
  mascotStates,
} from "@/brand/mascot.config";

export const metadata: Metadata = {
  title: "Brand and mascot",
  description: `The ${brand.name} mascot system: expressions, motion, voice and the rules for using them.`,
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * BRAND PAGE
 * ----------------------------------------------------------------------------
 * Not a marketing page. This is the working reference for anyone building a
 * surface with the mascot on it: every state, what it means, what it must not
 * be used for, the voice rules and the palette.
 *
 * It is `noindex` on purpose — it is documentation that happens to render.
 * ============================================================================
 */
export default function BrandPage() {
  return (
    <>
      <PageHero
        eyebrow="Brand system"
        title={`${mascot.name}, and how to use him.`}
        lead={mascot.premise}
      />

      {/* ---- the character ------------------------------------------------ */}
      <Section tone="paper" className="py-14 sm:py-16">
        <div className="page">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-center lg:gap-16">
            <div className="flex justify-center rounded-2xl bg-tint-signal p-10">
              <Mascot state="neutral" size="2xl" title={mascotAlt("neutral", brand.name)} />
            </div>
            <div>
              <h2 className="text-display-sm text-ink-950">
                A {mascot.species.toLowerCase()} who knows what things cost.
              </h2>
              <p className="mt-4 max-w-xl leading-relaxed text-ink-600">
                He is not an assistant and not a guide. He is the student in your building who
                already worked out which supermarket, which night, which ticket — and tells you
                without making a thing of it.
              </p>
              <ul className="mt-6 flex flex-wrap gap-2">
                {mascot.traits.map((trait) => (
                  <li
                    key={trait}
                    className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-700"
                  >
                    {trait}
                  </li>
                ))}
              </ul>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-mint-deep/20 bg-mint-soft p-4">
                  <p className="font-mono text-micro uppercase tracking-[0.12em] text-mint-deep">
                    Voice: do
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink-700">
                    {mascot.voice.do.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-pulse-deep/20 bg-pulse-soft p-4">
                  <p className="font-mono text-micro uppercase tracking-[0.12em] text-pulse-deep">
                    Voice: never
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink-700">
                    {mascot.voice.dont.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ---- states -------------------------------------------------------- */}
      <Section tone="warm" id="states">
        <div className="page">
          <Eyebrow index="01">Expressions</Eyebrow>
          <h2 className="mt-4 max-w-2xl text-display-sm text-ink-950">
            One face. Nine readings. Same silhouette every time.
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-ink-600">
            Only the eyes, brows and mouth change between these. The head, ears, muzzle, patch and
            collar are the same paths in all nine, which is what makes him one character rather
            than nine drawings.
          </p>

          <ul className="mt-10 grid gap-px overflow-hidden rounded-2xl bg-ink-200/70 sm:grid-cols-2 lg:grid-cols-3">
            {mascotStates.map((state) => {
              const guide = mascotStateGuide[state];
              return (
                <li key={state} className="flex flex-col bg-paper p-6">
                  <div className="flex items-center gap-4">
                    <MascotArt
                      state={state}
                      className="size-20"
                      title={mascotAlt(state, brand.name)}
                    />
                    <div>
                      <p className="font-display text-lg font-semibold tracking-[-0.02em] text-ink-950">
                        {guide.label}
                      </p>
                      <p className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
                        {state}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-ink-600">{guide.use}</p>
                  <p className="mt-3 border-t border-ink-200 pt-3 text-[0.8125rem] leading-relaxed text-ink-500">
                    {guide.avoid}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </Section>

      {/* ---- scale --------------------------------------------------------- */}
      <Section tone="paper">
        <div className="page">
          <Eyebrow index="02">Scale</Eyebrow>
          <h2 className="mt-4 max-w-2xl text-display-sm text-ink-950">
            The app-icon test: it has to read at 16 pixels.
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-ink-600">
            Most people meet a mascot as a notification, a tab favicon or a 24px avatar. The dark
            ear and the wide muzzle are what survive down there, so those two shapes carry the
            recognition and everything else is detail.
          </p>

          <div className="mt-10 flex flex-wrap items-end gap-8 rounded-2xl border border-ink-200 bg-paper-2 p-8">
            {([16, 24, 32, 48, 64, 96, 128] as const).map((px) => (
              <div key={px} className="flex flex-col items-center gap-3">
                <MascotArt state="neutral" style={{ width: px, height: px }} />
                <span className="tnum font-mono text-micro text-ink-400">{px}px</span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white p-4">
              <MascotAvatar state="social" size="lg" />
              <MascotAvatar state="excited" size="md" />
              <MascotAvatar state="neutral" size="sm" />
              <MascotAvatar state="thinking" size="xs" />
              <span className="ml-1 text-sm text-ink-500">In a disc, for feeds and stacks</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-console p-4" data-surface="dark">
              <MascotAvatar state="social" size="lg" onDark />
              <MascotAvatar state="excited" size="md" onDark />
              <span className="ml-1 text-sm text-white/50">On the product surface</span>
            </div>
          </div>
        </div>
      </Section>

      {/* ---- voice --------------------------------------------------------- */}
      <Section tone="tint">
        <div className="page">
          <Eyebrow index="03">Lines</Eyebrow>
          <h2 className="mt-4 max-w-2xl text-display-sm text-ink-950">
            The whole sanctioned library. Nothing else ships.
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-ink-600">
            Components read from <code className="font-mono text-[0.9em]">mascotLines</code> rather
            than writing their own copy. One voice across forty surfaces is not achievable any other
            way, and it is what stops him drifting into a support bot.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(mascotLines).map(([set, lines]) => (
              <div key={set} className="rounded-xl border border-ink-200 bg-white/80 p-5">
                <p className="font-mono text-micro uppercase tracking-[0.12em] text-ink-400">
                  {set}
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {lines.map((line) => (
                    <li key={line} className="text-[0.9375rem] text-ink-800">
                      &ldquo;{line}&rdquo;
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-8">
            <MascotSay state="excited" tone="paper">
              That one&rsquo;s actually free.
            </MascotSay>
            <MascotSay state="concerned" tone="signal">
              Take the free option tonight.
            </MascotSay>
          </div>
        </div>
      </Section>

      {/* ---- viral kit ----------------------------------------------------- */}
      <Section tone="paper" id="viral">
        <div className="page">
          <Eyebrow index="04">Viral kit</Eyebrow>
          <h2 className="mt-4 max-w-2xl text-display-sm text-ink-950">
            The parts designed to leave the site.
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-ink-600">
            Stickers and reactions use a hard keyline and a solid offset shadow — deliberately the
            opposite of the soft glass used everywhere else, so &ldquo;this object is meant to be
            screenshotted and sent&rdquo; is a visual rule rather than a caption. All of it is DOM,
            not exported images, so it restyles with the brand instead of going stale in a folder.
          </p>

          <h3 className="mt-10 font-mono text-micro uppercase tracking-[0.14em] text-ink-400">
            Stickers
          </h3>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-ink-200 bg-paper-2 p-6">
            {stickerSheet.map((spec) => (
              <SheetSticker key={spec.key} spec={spec} />
            ))}
          </div>

          <h3 className="mt-10 font-mono text-micro uppercase tracking-[0.14em] text-ink-400">
            Reactions
          </h3>
          <div className="mt-4 flex flex-wrap gap-3 rounded-2xl border border-ink-200 bg-paper-2 p-6">
            {(
              [
                ["excited", "Good find", "signal"],
                ["celebrating", "Budget survived", "paper"],
                ["empty", "Nothing here", "paper"],
                ["concerned", "Skip the €8 coffee", "paper"],
                ["survival", "Game plan", "ink"],
                ["social", "Three going", "paper"],
              ] as const
            ).map(([state, label, tone]) => (
              <MascotReaction key={state} state={state} label={label} tone={tone} />
            ))}
          </div>

          <h3 className="mt-10 font-mono text-micro uppercase tracking-[0.14em] text-ink-400">
            Doodles
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">
            Punctuation, not decoration. Every mark inherits <code className="font-mono">currentColor</code>{" "}
            so it belongs to the accent of whatever it annotates, and all six share one stroke
            weight — mixed weights are what make a hand-drawn set look like three different files.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-8 rounded-2xl border border-ink-200 bg-paper-2 p-6 text-ink-800">
            <DoodleStar className="size-8 text-signal-deep" />
            <DoodlePin className="size-8 text-pulse-deep" />
            <DoodleCoin className="size-8 text-flow-deep" />
            <DoodleBubble className="size-8 text-mint-deep" />
            <DoodleRoute className="size-8 text-amber-deep" />
            <DoodleTag className="size-8 text-ink-700" />
          </div>
        </div>
      </Section>

      {/* ---- accessibility -------------------------------------------------- */}
      <Section tone="warm" id="accessibility">
        <div className="page">
          <Eyebrow index="05">Accessibility</Eyebrow>
          <h2 className="mt-4 max-w-2xl text-display-sm text-ink-950">
            He is decorative almost everywhere, and that is the point.
          </h2>

          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                title: "No name by default",
                body: "Pass no title and the SVG is hidden from assistive technology entirely. His expression always restates something the copy beside him already says, so announcing it twice costs a screen reader user a stop and teaches them nothing.",
              },
              {
                title: "Never the only signal",
                body: "A budget warning is a number and a sentence first. The face is a second, redundant channel — remove him and no information is lost, which is the test every placement has to pass.",
              },
              {
                title: "Never over a control",
                body: "Placements that would overlap a button are simply not rendered below the breakpoint where they collide. A mascot that covers a tap target is a bug, not a flourish.",
              },
              {
                title: "Motion is optional",
                body: "Blink, twitch, bob and pop are CSS animations with no fill mode, so prefers-reduced-motion collapses them to a composed static character rather than a frozen mid-blink one.",
              },
              {
                title: "Contrast is carried by the page",
                body: "The character sits on paper or in a light disc, never on a ground that puts near-black on near-black. Text near him meets contrast on its own, without relying on his colours.",
              },
              {
                title: "One line, one screen",
                body: "At most one piece of mascot dialogue per view. Two speech bubbles on one screen turns a character into a chat interface nobody asked for.",
              },
            ].map((rule) => (
              <li key={rule.title} className="rounded-xl border border-ink-200 bg-paper p-5">
                <h3 className="text-[0.9375rem] font-semibold text-ink-950">{rule.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{rule.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </>
  );
}
