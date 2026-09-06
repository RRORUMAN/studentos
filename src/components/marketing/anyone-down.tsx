import { ArrowRight, Clock3, DoorOpen, MessagesSquare, PartyPopper, UserRoundCheck, UsersRound } from "lucide-react";

import { MascotArt } from "@/components/mascot/mascot-art";
import { InviteCard } from "@/components/product/invite-card";
import { Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { ButtonLink } from "@/components/ui/button";
import { brand } from "@/brand/brand.config";
import { defaultInvite } from "@/data/social";
import { cn } from "@/lib/utils";

const POINTS = [
  {
    icon: DoorOpen,
    title: "Open to the city, not to a friend group",
    body: "Anyone in your city can see it. That is the only way it works in your first month, when you do not have a group yet.",
  },
  {
    icon: Clock3,
    title: "The group closes afterwards",
    body: "Chats are temporary by default. Nobody collects contacts, nobody is stuck in a dead group from October.",
  },
  {
    icon: UserRoundCheck,
    title: "Maybe is a real answer",
    body: "Say maybe and you get one nudge if the plan is still short. No guilt, no group of five people waiting on you.",
  },
] as const;

export function AnyoneDown() {
  return (
    <Section id="anyone-down" tone="paper">
      <div className="page">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-center lg:gap-14">
          <div>
            <Reveal>
              <Eyebrow index="06">{brand.surfaces.anyoneDown}</Eyebrow>
              <h2 className="mt-4 text-display-md text-ink-950">
                Find something to do.
                <br />
                <span className="text-ink-400">Then find people to do it with.</span>
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600">
                The hardest part of a new city is not finding things to do. It is finding someone to
                do them with in week two, before anyone has a group. So a plan and a group are the
                same object here.
              </p>
            </Reveal>

            <RevealGroup className="mt-8 flex flex-col gap-5">
              {POINTS.map((point) => {
                const Icon = point.icon;
                return (
                  <RevealItem key={point.title} className="flex gap-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-md bg-pulse-soft text-pulse-deep">
                      <Icon className="size-4.5" aria-hidden />
                    </span>
                    <div>
                      <h3 className="text-[0.9375rem] font-semibold text-ink-950">{point.title}</h3>
                      <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-600">
                        {point.body}
                      </p>
                    </div>
                  </RevealItem>
                );
              })}
            </RevealGroup>

            {/* ---- the loop ------------------------------------------------
                Four steps, one row. The section's whole claim is that a plan
                and a group are the same object, and a sequence says that
                faster than another paragraph does. The last step is the one
                that matters: it ends. */}
            <Reveal delay={0.08}>
              <ol className="mt-9 flex flex-wrap items-stretch gap-2">
                {(
                  [
                    { icon: DoorOpen, label: "Someone posts a plan", tone: "bg-pulse-soft text-pulse-deep" },
                    { icon: UsersRound, label: "Students nearby join", tone: "bg-flow-soft text-flow-deep" },
                    { icon: MessagesSquare, label: "A group chat opens", tone: "bg-signal-soft text-signal-deep" },
                    { icon: PartyPopper, label: "It happens, then closes", tone: "bg-mint-soft text-mint-deep" },
                  ] as const
                ).map((step, index, all) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.label} className="flex items-center gap-2">
                      <div className="flex items-center gap-2.5 rounded-xl border border-ink-200 bg-white px-3 py-2.5">
                        <span className={cn("grid size-7 shrink-0 place-items-center rounded-md", step.tone)}>
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="text-[0.8125rem] font-medium text-ink-800">{step.label}</span>
                      </div>
                      {index < all.length - 1 ? (
                        <ArrowRight className="size-3.5 shrink-0 text-ink-300" aria-hidden />
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <ButtonLink href="/get-started" variant="primary" size="lg">
                  Find something to join
                </ButtonLink>
                <span className="inline-flex items-center gap-2.5">
                  <MascotArt state="social" className="size-11 shrink-0" />
                  <span className="text-sm text-ink-500">Three people are already going.</span>
                </span>
              </div>
            </Reveal>
          </div>

          <Reveal kind="blur" className="w-full">
            <InviteCard invite={defaultInvite} />
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
