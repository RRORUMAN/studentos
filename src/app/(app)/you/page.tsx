import {
  Bell,
  BookOpen,
  CalendarClock,
  ChevronRight,
  CreditCard,
  Download,
  GraduationCap,
  Heart,
  Home,
  LogOut,
  MapPin,
  MessagesSquare,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { neighbourhoodsForCity } from "@/data/neighbourhoods";
import { MORE_DESTINATIONS } from "@/config/destinations";
import { MascotArt } from "@/components/mascot/mascot-art";
import { planByKey } from "@/config/pricing";
import { signOutAction } from "@/server/actions/auth";
import { findMany } from "@/server/db";
import { loadWeeklyRecap } from "@/server/queries/money";
import { loadFriendIds } from "@/server/queries/social";
import { requireViewer } from "@/server/viewer";
import { cn, money } from "@/lib/utils";

export const metadata: Metadata = {
  title: "You",
  robots: { index: false, follow: false },
};

/**
 * ============================================================================
 * YOU
 * ----------------------------------------------------------------------------
 * Not a settings page with a name on top. The week first, then the things a
 * student comes here for — friends, city, budget, arrival, saved — then the
 * plan, then settings, then the door.
 * ============================================================================
 */
export default async function YouPage() {
  const viewer = await requireViewer();
  const where = viewer.currency;
  const plan = planByKey(viewer.entitlements.plan);

  const [recap, friendIds, pendingRequests, groups] = await Promise.all([
    loadWeeklyRecap(viewer.user.id),
    loadFriendIds(viewer.user.id),
    findMany("friendships", (row) => row.addresseeId === viewer.user.id && row.status === "pending"),
    findMany("inviteResponses", (row) => row.userId === viewer.user.id && row.status === "in"),
  ]);

  const asks = viewer.entitlements.quotas.aiAsksPerWeek;
  const cityAreas = neighbourhoodsForCity(viewer.profile.citySlug);

  const sections: { title: string; items: { href: string; label: string; detail?: string; icon: typeof Bell; badge?: number }[] }[] = [
    {
      title: "Everything else",
      items: MORE_DESTINATIONS.map((entry) => ({ href: entry.href, label: entry.label, detail: entry.detail, icon: entry.icon })),
    },
    {
      title: "Your city",
      items: [
        { href: "/you/friends", label: "Friends", detail: `${friendIds.size} ${friendIds.size === 1 ? "friend" : "friends"}`, icon: Users, badge: pendingRequests.length },
        { href: "/pulse/chat", label: "Groups and chats", detail: `${groups.length} ${groups.length === 1 ? "group" : "groups"} you are in`, icon: MessagesSquare },
        { href: "/you/city", label: "My city", detail: `${viewer.city.name}${viewer.profile.homeArea ? ` · ${viewer.profile.homeArea}` : ""}`, icon: MapPin },
        {
          href: "/neighbourhoods",
          label: "Where should I live?",
          detail: cityAreas.length > 0
            ? `${cityAreas.length} areas, ranked against your budget and commute`
            : "No areas written up in your city yet",
          icon: Home,
        },
        {
          href: "/arrival",
          label: viewer.stage.stage === "leaving" ? "Leaving Mode" : "Arrival Mode",
          detail: viewer.stage.stage === "established" ? "Settled. Still here if you need it." : "Your move, in order",
          icon: CalendarClock,
        },
        { href: "/starter-pack", label: "Starter pack", detail: `The first things worth knowing in ${viewer.city.name}`, icon: Sparkles },
        { href: "/guides", label: "Guides and official info", detail: "Sourced answers with the date each was checked", icon: BookOpen },
      ],
    },
    {
      title: "You",
      items: [
        { href: "/you/profile", label: "Profile and interests", detail: `${viewer.profile.interests.length} interests`, icon: Heart },
        {
          href: "/you/profile",
          label: "University and dates",
          detail: viewer.profile.universityName ?? viewer.campusName ?? "Not set — it changes what you see",
          icon: GraduationCap,
        },
        { href: "/you/notifications", label: "Notifications", icon: Bell },
        { href: "/you/privacy", label: "Privacy and visibility", icon: Shield },
        { href: "/you/data", label: "Your data", detail: "Export, reset what it learned, delete", icon: Download },
      ],
    },
  ];

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <header className="flex items-center gap-4">
        <span aria-hidden className="grid size-16 shrink-0 place-items-center rounded-full bg-signal-soft text-3xl ring-1 ring-ink-950/8">
          {viewer.profile.avatarEmoji}
        </span>
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-display-xs text-ink-950">
            {viewer.profile.displayName}
            {viewer.profile.studentVerifiedAt ? <ShieldCheck className="size-5 text-mint-deep" aria-label="Student verified" /> : null}
          </h1>
          <p className="mt-1 text-[0.9375rem] text-ink-500">
            {viewer.city.name}{viewer.campusName ? ` · ${viewer.campusName}` : ""} · @{viewer.profile.handle}
          </p>
        </div>
      </header>

      {/* ---- your week ------------------------------------------------------ */}
      <section className="mt-6 rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
        <div className="flex items-start gap-4">
          <MascotArt state="neutral" className="size-11 shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="text-[1.0625rem] font-semibold text-ink-950">Your week</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Stat label="Spent" value={money(recap.spentCents / 100, where)} />
              <Stat label="Target" value={money(recap.targetCents / 100, where)} />
              <Stat label="Places found" value={String(recap.placesDiscovered)} />
              <Stat label="Events saved" value={String(recap.eventsSaved)} />
            </dl>
          </div>
        </div>
      </section>

      {/* ---- plan ----------------------------------------------------------- */}
      <Link href="/upgrade" className="mt-4 flex items-center gap-4 rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6 transition-shadow hover:shadow-[var(--shadow-raise)]">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", plan.key === "free" ? "bg-paper-2" : "bg-signal-soft")}>
          {plan.key === "free" ? <CreditCard className="size-5 text-ink-500" /> : <Sparkles className="size-5 text-signal-deep" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold text-ink-950">{plan.name} · {plan.headline}</span>
          <span className="mt-0.5 block text-[0.8125rem] text-ink-500">
            {asks.limit !== null ? `${asks.remaining ?? 0} of ${asks.limit} smart asks left this week` : plan.tagline}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-ink-400" />
      </Link>

      {/* ---- sections ------------------------------------------------------- */}
      {sections.map((section) => (
        <section key={section.title} className="mt-5">
          <h2 className="mb-2 px-1 font-mono text-micro uppercase tracking-[0.12em] text-ink-400">{section.title}</h2>
          <nav className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
            <ul className="divide-y divide-ink-100">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={`${item.href}-${item.label}`}>
                    <Link href={item.href} className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-paper-2">
                      <Icon className="size-4.5 shrink-0 text-ink-400" strokeWidth={1.9} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.9375rem] text-ink-900">{item.label}</span>
                        {item.detail ? <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-500">{item.detail}</span> : null}
                      </span>
                      {item.badge ? <span className="tnum rounded-full bg-pulse px-2 py-0.5 text-[0.6875rem] font-semibold text-white">{item.badge}</span> : null}
                      <ChevronRight className="size-4 shrink-0 text-ink-300" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </section>
      ))}

      {/* ---- account -------------------------------------------------------- */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-[var(--shadow-flat)] ring-1 ring-ink-950/6">
        <p className="text-[0.8125rem] text-ink-500">Signed in as</p>
        <p className="mt-0.5 text-[0.9375rem] text-ink-900">{viewer.user.email}</p>
        {!viewer.user.emailVerifiedAt ? (
          <Link href="/verify-email" className="mt-2 inline-block text-[0.8125rem] font-medium text-amber-deep underline underline-offset-4">Confirm your email</Link>
        ) : null}
        <form action={signOutAction} className="mt-4">
          <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-paper-2 px-4 py-2 text-[0.875rem] font-medium text-ink-700 transition-colors hover:bg-ink-100">
            <LogOut className="size-4" />
            Sign out
          </button>
        </form>
      </div>

      <p className="mt-6 text-[0.8125rem] text-ink-400">
        Your budget, transactions and home location are never shown to other students.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-micro uppercase tracking-[0.1em] text-ink-400">{label}</dt>
      <dd className="tnum mt-0.5 font-mono text-[1.125rem] font-semibold text-ink-950">{value}</dd>
    </div>
  );
}
