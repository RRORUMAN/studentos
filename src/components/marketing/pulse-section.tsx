import { ArrowUp, MessageSquare } from "lucide-react";

import { MascotStill } from "@/components/mascot/mascot";
import { accents } from "@/components/ui/accent";
import { ButtonLink } from "@/components/ui/button";
import { Avatar, Badge, SampleTag, Section, SectionHeader } from "@/components/ui/primitives";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { catchUpItems, landingPulse, loopKindMeta } from "@/data/loop";
import { cn, ago, money } from "@/lib/utils";

/**
 * ============================================================================
 * STUDENT PULSE
 * ----------------------------------------------------------------------------
 * The community layer, shown as what it is: a feed of small, useful, checkable
 * things students post about the city they are in. Deliberately not a wall of
 * engagement metrics — a post earns its place with a price, a time or a
 * confirmation count, and the sample marker says out loud that these rows are
 * illustrative.
 *
 * The catch-up card is the other half of the argument: the product summarises
 * what you missed instead of asking you to scroll it.
 * ============================================================================
 */
export function PulseSection() {
  return (
    <Section id="pulse" tone="pulse">
      <div className="page">
        <SectionHeader
          eyebrow={brand.surfaces.pulse}
          eyebrowIndex="04"
          title="Know what students actually know."
          lead="Deals, events, warnings and questions from students at your university and in your city. Voted on, corrected, and confirmed by the people who went."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-8">
          {/* ---- the feed --------------------------------------------------- */}
          <RevealGroup step={0.05} className="flex flex-col gap-3">
            {landingPulse.map((post) => {
              const meta = loopKindMeta[post.kind];
              const accent = accents[meta.accent];
              return (
                <RevealItem key={post.id}>
                  <article className="rounded-xl bg-white p-4 shadow-[var(--shadow-raise)] ring-1 ring-ink-950/5">
                    <div className="flex items-start gap-3">
                      {/* vote column */}
                      <div className="flex w-9 shrink-0 flex-col items-center gap-0.5 rounded-lg bg-paper-2 py-1.5">
                        <ArrowUp className="size-3.5 text-ink-400" aria-hidden />
                        <span className="tnum font-mono text-xs font-semibold text-ink-700">
                          {post.upvotes}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge accent={meta.accent} tone="soft">
                            {meta.label}
                          </Badge>
                          {post.price !== undefined ? (
                            <span
                              className={cn(
                                "tnum font-mono text-xs font-semibold",
                                post.price === 0 ? "text-mint-deep" : "text-ink-700",
                              )}
                            >
                              {post.price === 0 ? "Free" : money(post.price)}
                            </span>
                          ) : null}
                          {post.when ? (
                            <span className="text-xs text-ink-500">{post.when}</span>
                          ) : null}
                        </div>

                        <h3 className="mt-1.5 text-[0.9375rem] font-semibold text-ink-950">
                          {post.title}
                        </h3>
                        {post.body ? (
                          <p className="mt-1 text-[0.8125rem] leading-snug text-ink-600">
                            {post.body}
                          </p>
                        ) : null}

                        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <span className="flex items-center gap-1.5">
                            <Avatar initials={post.author.initials} size="xs" />
                            <span className="text-xs text-ink-500">
                              {post.author.handle} · {post.author.terms} terms here
                            </span>
                          </span>
                          <span className="flex items-center gap-1 text-xs text-ink-400">
                            <MessageSquare className="size-3.5" aria-hidden />
                            <span className="tnum">{post.comments}</span>
                          </span>
                          <span className="text-xs text-ink-400">
                            {ago(post.postedMinutesAgo)}
                          </span>
                          {post.signal ? (
                            <span className={cn("text-xs font-medium", accent.text)}>
                              {post.signal}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                </RevealItem>
              );
            })}
            <p className="flex items-center gap-2 text-xs text-ink-400">
              <SampleTag /> Illustrative posts and counts, in the product&rsquo;s own components.
            </p>
          </RevealGroup>

          {/* ---- catch me up ------------------------------------------------ */}
          <Reveal delay={0.08}>
            <div className="sticky top-24 flex flex-col gap-4">
              <div className="rounded-2xl bg-ink-950 p-5 text-white shadow-[var(--shadow-lift)]">
                <p className="flex flex-wrap items-center gap-2 font-mono text-micro uppercase tracking-[0.12em] text-signal">
                  Catch me up
                  <SampleTag onDark />
                </p>
                <h3 className="mt-2 text-display-xs text-white">
                  {catchUpItems.length} things worth knowing today
                </h3>
                <ul className="mt-4 flex flex-col gap-3">
                  {catchUpItems.map((item, index) => (
                    <li key={item.title} className="flex gap-3">
                      <span className="tnum mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-white/10 font-mono text-[0.625rem] text-white/70">
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[0.875rem] leading-snug font-medium text-white">
                          {item.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-white/45">{item.meta}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex items-center gap-2.5 border-t border-white/10 pt-4">
                  <MascotStill state="social" size="sm" />
                  <p className="text-[0.8125rem] text-white/60">
                    A day away is three lines, not 200 posts.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-raise)] ring-1 ring-ink-950/5">
                <p className="text-[0.9375rem] font-semibold text-ink-950">
                  Free on every tier, permanently.
                </p>
                <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-600">
                  Reading and posting, chat, votes, polls and joining plans are never metered.
                  Charging for other students would kill the thing that makes the rest work.
                </p>
                <ButtonLink
                  href="/get-started?intent=pulse"
                  variant="primary"
                  size="sm"
                  className="mt-4"
                >
                  Join your city&rsquo;s feed
                </ButtonLink>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
