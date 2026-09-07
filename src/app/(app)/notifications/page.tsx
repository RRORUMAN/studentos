import { Bell, Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { MarkAllReadButton } from "@/components/app/mark-read-button";
import { MascotArt } from "@/components/mascot/mascot-art";
import type { NotificationTopic } from "@/domain/types";
import { findMany } from "@/server/db";
import { notificationBody } from "@/server/notify";
import { minutesSince } from "@/server/now";
import { requireViewer } from "@/server/viewer";
import { ago, cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

const CATEGORY: Record<NotificationTopic, { label: string; accent: string }> = {
  "budget-warnings": { label: "Money", accent: "bg-flow-soft text-flow-deep" },
  "free-events": { label: "Events", accent: "bg-pulse-soft text-pulse-deep" },
  deals: { label: "Deals", accent: "bg-amber-soft text-amber-deep" },
  "friends-plans": { label: "Social", accent: "bg-signal-soft text-signal-deep" },
  plans: { label: "Plans", accent: "bg-signal-soft text-signal-deep" },
  campus: { label: "Campus", accent: "bg-flow-soft text-flow-deep" },
  pulse: { label: "Pulse", accent: "bg-ink-100 text-ink-600" },
  arrival: { label: "Arrival", accent: "bg-amber-soft text-amber-deep" },
  "weekend-ideas": { label: "StudentOS", accent: "bg-ink-100 text-ink-600" },
  answers: { label: "Answers", accent: "bg-mint-soft text-mint-deep" },
};

/**
 * Only what the student asked to be told about, grouped by what it is. Read
 * state is per row; "mark all read" is the only bulk action.
 */
export default async function NotificationsPage(props: PageProps<"/notifications">) {
  const viewer = await requireViewer();
  const params = await props.searchParams;
  const raw = Array.isArray(params.c) ? params.c[0] : params.c;

  const notifications = (await findMany("notifications", (row) => row.userId === viewer.user.id)).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  const categories = [...new Set(notifications.map((row) => CATEGORY[row.topic]?.label ?? "StudentOS"))];
  const active = categories.includes(raw ?? "") ? raw! : null;
  const visible = active ? notifications.filter((row) => (CATEGORY[row.topic]?.label ?? "StudentOS") === active) : notifications;
  const unread = notifications.filter((row) => row.readAt === null).length;

  return (
    <div className="page max-w-2xl py-6 sm:py-8">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-display-xs text-ink-950 sm:text-display-sm">Notifications</h1>
          <p className="mt-1.5 text-[0.9375rem] text-ink-500">{unread > 0 ? `${unread} unread.` : "You are caught up."} Only what you asked to be told about.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <MarkAllReadButton count={unread} />
          <Link href="/you/notifications" aria-label="Notification settings" className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-ink-500 ring-1 ring-ink-950/8 hover:text-ink-900">
            <Settings className="size-4" />
          </Link>
        </div>
      </header>

      {categories.length > 1 ? (
        <nav aria-label="Categories" className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0">
          <Link href="/notifications" className={cn("inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[0.8125rem] font-medium", !active ? "bg-ink-950 text-paper" : "bg-white text-ink-700 ring-1 ring-ink-950/8")}>All</Link>
          {categories.map((category) => (
            <Link key={category} href={`/notifications?c=${encodeURIComponent(category)}`} className={cn("inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[0.8125rem] font-medium", active === category ? "bg-ink-950 text-paper" : "bg-white text-ink-700 ring-1 ring-ink-950/8")}>
              {category}
            </Link>
          ))}
        </nav>
      ) : null}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-white px-5 py-12 text-center ring-1 ring-ink-950/6">
          <MascotArt state="neutral" className="size-16" />
          <p className="mt-4 text-[0.9375rem] text-ink-700">Nothing yet — which is the point. We only send what you switched on.</p>
          <Link href="/you/notifications" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink-950 px-4 py-2 text-[0.875rem] font-medium text-paper">
            <Bell className="size-3.5" />
            Choose what is worth interrupting you for
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((notification) => {
            const meta = CATEGORY[notification.topic] ?? CATEGORY["weekend-ideas"];
            const body = (
              <>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold", meta.accent)}>{meta.label}</span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[0.9375rem]", notification.readAt ? "text-ink-600" : "font-medium text-ink-950")}>{notification.title}</span>
                  <span className="mt-0.5 block text-[0.8125rem] leading-snug text-ink-500">{notificationBody(notification.body)}</span>
                </span>
                <span className="shrink-0 font-mono text-micro text-ink-400">{ago(minutesSince(notification.createdAt))}</span>
              </>
            );
            const className = cn("flex items-start gap-3 rounded-xl p-4 ring-1 transition-shadow", notification.readAt ? "bg-white ring-ink-950/6" : "bg-signal-soft/40 ring-signal-deep/20 hover:shadow-[var(--shadow-raise)]");
            return (
              <li key={notification.id}>
                {notification.href ? <Link href={notification.href} className={className}>{body}</Link> : <div className={className}>{body}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
