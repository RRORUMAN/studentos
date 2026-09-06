import { BadgeCheck, Footprints, Tag } from "lucide-react";

import { MascotArt } from "@/components/mascot/mascot-art";
import { CityMap } from "@/components/product/city-map";
import { Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { brand } from "@/brand/brand.config";
import { defaultCity } from "@/data/cities";
import { mascotLine } from "@/brand/mascot.config";
import { STUDENT_VERIFIED_THRESHOLD } from "@/services/db/schema";

const RULES = [
  {
    icon: Tag,
    title: "Price before name",
    body: "Every pin carries what a student actually spends there, not a €€ symbol that means nothing.",
  },
  {
    icon: Footprints,
    title: "Distance in minutes",
    body: "Nobody has a feel for 1.4 kilometres in a city they moved to last week. Everything is a walk time.",
  },
  {
    icon: BadgeCheck,
    title: "Verified means verified",
    body: `The badge needs ${STUDENT_VERIFIED_THRESHOLD} independent student confirmations, and the count is always printed next to it. Below that, you see the count and no badge.`,
  },
] as const;

export function DiscoverSection() {
  return (
    <Section id="discover" tone="paper">
      <div className="page">
        <Reveal>
          <Eyebrow index="09">{brand.surfaces.discover}</Eyebrow>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="max-w-2xl text-display-md text-ink-950">
              A map that answers &ldquo;can I afford this and how far is it&rdquo;.
            </h2>
            <p className="max-w-md text-base leading-relaxed text-ink-600">
              Layers are the filters students actually use. Turn on Cheap Food and Free, switch on
              Student Verified, and what is left is a plan.
            </p>
          </div>
        </Reveal>

        <Reveal kind="blur" delay={0.05} className="mt-10">
          <div className="relative">
            <CityMap citySlug={defaultCity.slug} />

            {/* He leans on the corner of the map and points into it, which is
                the only mascot placement on the page that overlaps a product
                surface. It works here because the map has generous dead space
                at its edge and because "a local telling you which pin is
                actually worth it" is exactly what the section claims.

                Hidden below `lg`: on a phone the map is edge to edge and there
                is no dead corner to stand in. */}
            <div className="pointer-events-none absolute -right-3 -bottom-5 hidden items-end gap-2 lg:flex">
              <span className="mb-5 rounded-2xl bg-white px-3 py-1.5 text-[0.8125rem] font-medium whitespace-nowrap text-ink-800 shadow-[var(--shadow-float)] ring-1 ring-ink-950/6">
                {mascotLine("explore", 1)}
              </span>
              <MascotArt state="explorer" className="size-20 -scale-x-100" />
            </div>
          </div>
        </Reveal>

        <RevealGroup className="mt-8 grid gap-3 sm:grid-cols-3">
          {RULES.map((rule) => {
            const Icon = rule.icon;
            return (
              <RevealItem
                key={rule.title}
                className="rounded-lg border border-ink-200 bg-paper-2 p-5"
              >
                <span className="grid size-9 place-items-center rounded-md bg-mint-soft text-mint-deep">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <h3 className="mt-3 text-[0.9375rem] font-semibold text-ink-950">{rule.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{rule.body}</p>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </div>
    </Section>
  );
}
