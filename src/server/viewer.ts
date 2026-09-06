import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import type { CityContext } from "@/data/types";
import { defaultCityContext, getCampus, resolveCity } from "@/data/cities";
import { type Move, resolveStage, type StageReading } from "@/domain/lifecycle";
import type { Profile, User } from "@/domain/types";
import { readSession } from "@/server/auth/session";
import { type Entitlements, loadEntitlements } from "@/server/entitlements";
import { cityStatusOverride } from "@/server/queries/settings";
import { findOne } from "@/server/db";
import { env } from "@/services/env";

/**
 * ============================================================================
 * VIEWER
 * ----------------------------------------------------------------------------
 * The composed context every authenticated surface reads: who this is, what
 * they bought, where they are in the move, and which city they are looking at.
 *
 * Assembled once per request and memoised with React's `cache`, so a page that
 * renders eight server components asking "who is this?" performs one set of
 * reads rather than eight. Without that, the Home screen alone would re-read
 * the profile and subscription a dozen times.
 *
 * Note what is deliberately NOT on this object: `homePoint`. The precise home
 * coordinate is loaded only by the two engines that need it (distance scoring
 * and the map's "from home" line) through an explicit call, so it cannot be
 * accidentally serialised into a client component by a careless prop spread.
 * ============================================================================
 */

export type Viewer = {
  user: User;
  profile: Profile;
  move: Move | null;
  entitlements: Entitlements;
  /** Where they are in the lifecycle. Drives the Home layout. */
  stage: StageReading;
  city: CityContext;
  campusName: string | null;
  /** Convenience for `money()` calls, which happen on nearly every screen. */
  currency: { currency: string; locale: string };
};

/* -------------------------------------------------------------------------- */
/* Load                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The signed-in user, or null. Never redirects — used by surfaces that render
 * for both anonymous and signed-in visitors.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await readSession();
  if (!session) return null;

  const { user } = session;
  const profile = await findOne("profiles", (row) => row.userId === user.id);
  /* An account with no profile row has signed up but not finished onboarding.
     That is a real state, not an error: `requireOnboarded` routes it. */
  if (!profile) return null;

  const [move, entitlements] = await Promise.all([
    findOne("moves", (row) => row.userId === user.id),
    loadEntitlements(user.id),
  ]);

  const stage = resolveStage({
    arrivingOn: move?.arrivingOn ?? profile.arrivingOn,
    leavingOn: move?.leavingOn ?? profile.leavingOn,
    joinedAt: profile.createdAt,
  });

  const resolved = resolveCity(profile.citySlug) ?? defaultCityContext;
  /* An admin can launch or pause a city without a deploy. */
  const override = await cityStatusOverride(resolved.slug);
  const city = override ? { ...resolved, status: override } : resolved;
  const campus = profile.campusSlug ? getCampus(profile.campusSlug) : undefined;

  return {
    user,
    profile,
    move,
    entitlements,
    stage,
    city,
    campusName: campus?.shortName ?? profile.universityName ?? null,
    currency: { currency: profile.currency, locale: profile.locale },
  };
});

/**
 * Whether an account exists but has not been through onboarding. Separated
 * from `getViewer` because the answer routes differently: signed out goes to
 * /login, signed in but unfinished goes to /onboarding.
 */
export const getAccount = cache(async (): Promise<{ user: User; onboarded: boolean } | null> => {
  const session = await readSession();
  if (!session) return null;
  const profile = await findOne("profiles", (row) => row.userId === session.user.id);
  return { user: session.user, onboarded: Boolean(profile?.onboardedAt) };
});

/* -------------------------------------------------------------------------- */
/* Guards                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Require a fully set-up viewer, or redirect.
 *
 * Every page under `(app)` calls this. It is the authorisation boundary for
 * the product: a route that forgets it renders nothing useful, because every
 * data function below takes a user id that only this can supply.
 */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (viewer) return viewer;

  const account = await getAccount();
  /* Signed in but mid-onboarding: send them back to finish rather than to a
     login screen they would find baffling. */
  if (account) redirect("/onboarding");
  redirect("/login");
}

/**
 * Require an admin.
 *
 * Redirects rather than showing a 403: a 403 confirms the route exists, and an
 * admin surface is worth not advertising.
 *
 * Admin comes from the `isAdmin` column or the `ADMIN_EMAILS` allowlist. The
 * allowlist is the bootstrap path — without it the first admin could only be
 * created by editing the database by hand.
 */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  const allowlisted = env.adminEmails.includes(viewer.user.email.toLowerCase());
  if (!viewer.user.isAdmin && !allowlisted) redirect("/home");
  return viewer;
}

/**
 * The signed-in user id, for server actions.
 *
 * Actions need the id and nothing else, and loading the full viewer to get it
 * would run the entitlement pass on every keystroke of an autosaving form.
 */
export async function requireUserId(): Promise<string> {
  const session = await readSession();
  if (!session) redirect("/login");
  return session.user.id;
}

/**
 * Non-redirecting variant for actions that must return a typed error instead
 * of throwing a redirect — anything called from a client component that wants
 * to render its own "signed out" state.
 */
export async function currentUserId(): Promise<string | null> {
  const session = await readSession();
  return session?.user.id ?? null;
}

/* -------------------------------------------------------------------------- */
/* Private location                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The student's precise home coordinate.
 *
 * Isolated behind its own function, taking an explicit user id, for one
 * reason: it makes every read of the most sensitive value in the product
 * greppable. There are exactly three call sites, all server-side, all in
 * scoring code that returns a *distance* rather than the point itself.
 *
 * It is never attached to `Viewer`, never passed to a client component and
 * never included in a plan, a post or an invite.
 */
export async function readHomePoint(
  userId: string,
): Promise<{ lat: number; lng: number } | null> {
  const profile = await findOne("profiles", (row) => row.userId === userId);
  return profile?.homePoint ?? null;
}
