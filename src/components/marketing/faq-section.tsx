import { Plus } from "lucide-react";

import { MascotArt } from "@/components/mascot/mascot-art";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { faq, faqTopics } from "@/data/faq";

/**
 * ============================================================================
 * FAQ
 * ----------------------------------------------------------------------------
 * Built on native <details>/<summary>.
 *
 * That is not a shortcut, it is the correct control: it is keyboard operable
 * and screen-reader correct with no JavaScript, it is findable by the browser's
 * own in-page search even while collapsed (a custom accordion hides its content
 * from Ctrl+F, which is exactly what someone hunting for one answer is doing),
 * and it ships zero bytes of client bundle for a section most visitors never
 * open.
 *
 * Grouped by topic rather than presented as one long list, because the four
 * things a student is nervous about — cost, privacy, whether their city works,
 * whether anyone is actually there — are different anxieties and they should
 * not be interleaved.
 * ============================================================================
 */
export function FaqSection() {
  return (
    <Section id="faq" tone="warm">
      <div className="page">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-16">
          {/* ---- aside ------------------------------------------------------ */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Reveal>
              <Eyebrow index="17">Questions</Eyebrow>
              <h2 className="mt-4 text-display-sm text-ink-950">
                The things students ask before signing up.
              </h2>
              <p className="mt-4 leading-relaxed text-ink-600">
                Including the ones with an awkward answer. If something is not ready yet, it says
                not ready yet.
              </p>

              <div className="mt-7 flex items-center gap-3 rounded-xl border border-ink-200 bg-paper-2 p-4">
                <MascotArt state="neutral" className="size-12 shrink-0" />
                <p className="text-sm leading-relaxed text-ink-600">
                  Still unsure?{" "}
                  <a
                    href={`mailto:${brand.contact.support}`}
                    className="font-medium text-ink-950 underline decoration-ink-300 underline-offset-2 hover:decoration-ink-950"
                  >
                    Ask a person
                  </a>
                  . A real one replies.
                </p>
              </div>

              <ButtonLink href="/get-started" variant="signal" className="mt-6">
                Get started free
              </ButtonLink>
            </Reveal>
          </div>

          {/* ---- the questions ---------------------------------------------- */}
          <div className="flex flex-col gap-10">
            {faqTopics.map((topic) => {
              const items = faq.filter((item) => item.topic === topic.key);
              if (items.length === 0) return null;

              return (
                <Reveal key={topic.key}>
                  <section aria-labelledby={`faq-${topic.key}`}>
                    <h3
                      id={`faq-${topic.key}`}
                      className="font-mono text-micro uppercase tracking-[0.14em] text-ink-400"
                    >
                      {topic.label}
                    </h3>
                    <ul className="mt-3 divide-y divide-ink-200 border-y border-ink-200">
                      {items.map((item) => (
                        <li key={item.q}>
                          <details className="group">
                            <summary
                              className={[
                                "flex cursor-pointer list-none items-start gap-4 py-4",
                                "text-[1.0625rem] font-medium text-ink-950",
                                "transition-colors hover:text-ink-700",
                                // Safari still paints a disclosure triangle
                                // without this, which throws the whole row out
                                // of alignment.
                                "[&::-webkit-details-marker]:hidden",
                              ].join(" ")}
                            >
                              <span className="flex-1">{item.q}</span>
                              <span
                                aria-hidden
                                className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-ink-200 text-ink-500 transition-transform duration-200 group-open:rotate-45 group-open:border-ink-950 group-open:bg-ink-950 group-open:text-signal"
                              >
                                <Plus className="size-3.5" />
                              </span>
                            </summary>
                            <p className="max-w-2xl pb-5 text-[0.9375rem] leading-relaxed text-ink-600">
                              {item.a}
                            </p>
                          </details>
                        </li>
                      ))}
                    </ul>
                  </section>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </Section>
  );
}
