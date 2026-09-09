import { Bell } from "lucide-react";
import Link from "next/link";

import { AppMark, DesktopAsk, DesktopNav, MobileNav } from "@/components/app/app-nav";
import { QuickCommand } from "@/components/app/quick-command";
import { SeededDataNotice } from "@/components/app/seeded-notice";
import { findMany, isSeededData } from "@/server/db";
import { requireViewer } from "@/server/viewer";

/**
 * ============================================================================
 * APP SHELL
 * ----------------------------------------------------------------------------
 * The authenticated product. Its own chrome, no marketing nav, no footer.
 *
 * `requireViewer` here is the authorisation boundary for everything under
 * `(app)`: it redirects to /login when signed out and to /onboarding when the
 * account exists but has no profile. Individual pages never handle either
 * case, and a page that forgets to check is still protected.
 * ============================================================================
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const viewer = await requireViewer();

  const unread = await findMany(
    "notifications",
    (row) => row.userId === viewer.user.id && row.readAt === null,
  );

  return (
    <div className="flex min-h-full flex-col bg-paper">
      <header className="sticky top-0 z-40 border-b border-ink-200/60 bg-paper/90 backdrop-blur-md">
        <div className="page flex h-14 items-center gap-3 lg:h-16">
          <AppMark city={viewer.city.name} campus={viewer.campusName} />

          <div className="flex flex-1 justify-center">
            <DesktopNav />
          </div>

          <div className="flex items-center gap-1.5">
            <QuickCommand />
            <DesktopAsk />

            <Link
              href="/notifications"
              className="relative grid size-10 place-items-center rounded-full text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-950"
              aria-label={
                unread.length > 0 ? `Notifications, ${unread.length} unread` : "Notifications"
              }
            >
              <Bell className="size-5" strokeWidth={1.9} />
              {unread.length > 0 ? (
                <span
                  aria-hidden
                  className="absolute top-2 right-2 size-2 rounded-full bg-pulse ring-2 ring-paper"
                />
              ) : null}
            </Link>

            <Link
              href="/you"
              aria-label="Your profile"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-signal-soft text-base ring-1 ring-ink-950/8"
            >
              <span aria-hidden>{viewer.profile.avatarEmoji}</span>
            </Link>
          </div>
        </div>
      </header>

      {isSeededData ? <SeededDataNotice /> : null}

      <main id="main" className="flex-1 pb-28 lg:pb-16">
        {children}
      </main>

      <MobileNav />
    </div>
  );
}
