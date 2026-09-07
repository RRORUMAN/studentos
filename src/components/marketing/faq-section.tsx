"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Section, SectionHeader } from "@/components/ui/primitives";
import { brand } from "@/brand/brand.config";
import { faq, faqTopics, type FaqItem } from "@/data/faq";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * FAQ
 * ----------------------------------------------------------------------------
 * Sits after pricing, because most of the questions a student has are created
 * by the price. Native `details` elements: they are keyboard operable, they
 * open before hydration, and they are findable with the browser's own search.
 * ============================================================================
 */
export function FaqSection() {
  const [topic, setTopic] = useState<FaqItem["topic"] | null>(null);
  const visible = faq.filter((item) => (topic ? item.topic === topic : true));

  return (
    <Section id="faq" tone="warm">
      <div className="page">
        <SectionHeader
          eyebrow="Questions"
          eyebrowIndex="18"
          title="The awkward questions, answered."
          lead="What it costs, what happens to your location, whether it works where you are going, and whether any of this is real."
        />

        <div className="mt-7 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar edge-fade-x">
          <Chip accent="flow" active={topic === null} onClick={() => setTopic(null)}>
            All
          </Chip>
          {faqTopics.map((entry) => (
            <Chip
              key={entry.key}
              accent="flow"
              active={topic === entry.key}
              count={faq.filter((item) => item.topic === entry.key).length}
              onClick={() => setTopic(topic === entry.key ? null : entry.key)}
            >
              {entry.label}
            </Chip>
          ))}
        </div>

        <div className="mt-6 grid gap-2.5 lg:grid-cols-2">
          {visible.map((item) => (
            <details
              key={item.q}
              className={cn(
                "group rounded-xl bg-white px-4 py-3.5 shadow-[var(--shadow-flat)]",
                "open:shadow-[var(--shadow-raise)]",
              )}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[0.9375rem] font-medium text-ink-950 [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown
                  className="size-4 shrink-0 text-ink-400 transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="mt-2.5 text-[0.875rem] leading-relaxed text-ink-600">{item.a}</p>
            </details>
          ))}
        </div>

        <p className="mt-7 text-[0.9375rem] text-ink-600">
          Still unsure?{" "}
          <a
            href={`mailto:${brand.contact.support}`}
            className="font-medium text-ink-950 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-950"
          >
            {brand.contact.support}
          </a>{" "}
          reaches a person.
        </p>

        <ButtonLink href="/pricing" variant="outline" className="mt-4">
          See the full pricing page
        </ButtonLink>
      </div>
    </Section>
  );
}
