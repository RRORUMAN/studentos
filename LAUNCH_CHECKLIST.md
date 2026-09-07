# Launch checklist

Ordered by what blocks what. `docs/configuration.md` has the dashboard steps for
every service named here.

Anything marked **BLOCKER** means the product is not safe to put in front of the
public until it is done — not that it is missing a nice-to-have.

---

## 1. Data

- [ ] **BLOCKER** Supabase production project created, separate from any
      staging project
- [ ] **BLOCKER** Every migration applied in order: `0001_init.sql`,
      `0002_daily_product.sql`, `0003_operations.sql`,
      `0004_lifeops_missions_exchange.sql`
- [ ] **BLOCKER** `postgis`, `vector` and `pgcrypto` extensions enabled
- [ ] **BLOCKER** The Supabase repository behind the six functions in
      `src/server/db/store.ts` is implemented. **Until this exists, setting the
      Supabase variables changes nothing: storage is still a JSON file on the
      instance, and on a serverless host it is wiped on every restart.** This is
      the one remaining engineering task between here and production.
- [ ] RLS verified by hand, not just by reading the migration. Sign in as two
      accounts and confirm: B cannot read A's budget, transactions, private
      plan, DM channel, or `home_point`. The e2e suite covers the first four
      against the JSON store; repeat them against Postgres.
- [ ] Point-in-time recovery on
- [ ] A restore actually tested once, into a scratch project

## 2. Identity

- [ ] **BLOCKER** `RESEND_API_KEY` and `RESEND_FROM` set, domain verified with
      SPF, DKIM and DMARC. **While the key is unset the app shows the email
      verification link on screen instead of sending it**, which means anyone
      can verify any address.
- [ ] Google OAuth client created, redirect URI
      `https://<domain>/api/auth/google/callback` registered
- [ ] `NEXT_PUBLIC_SITE_URL` set to the real domain (share links, sitemap and
      the OAuth callback all read it)
- [ ] Sign-up, verify, sign-in, sign-out, forgot password and reset walked by
      hand on a phone
- [ ] `ADMIN_EMAILS` set to real addresses, and `/admin` confirmed to redirect
      for a non-admin account

## 3. Money

- [ ] Stripe in **live** mode, three products with monthly and annual prices
- [ ] All six `STRIPE_PRICE_*` ids set
- [ ] Webhook endpoint added at `https://<domain>/api/stripe/webhook` with
      `STRIPE_WEBHOOK_SECRET` set
- [ ] Customer portal enabled, with plan change and cancellation allowed
- [ ] A real card charged once end to end, then refunded: checkout → entitlement
      unlocks → portal → cancel → access continues to period end
- [ ] Failed payment path checked (`4000 0000 0000 0341`) — access should
      continue through Stripe's retry window, not drop the same hour

## 4. AI

- [ ] Decide whether to launch with a model at all. The product is complete
      without one; a key only makes explanations more fluent.
- [ ] If yes: `AI_PROVIDER` and `AI_API_KEY` set
- [ ] Daily and monthly euro spend caps set in `/admin` (defaults: €12/day,
      €200/month across all users)
- [ ] Per-user daily call cap reviewed (default 40)
- [ ] `/admin` → AI cost → Tier 0 share is above 70%. Below that, something that
      should be arithmetic is calling a model.

## 5. Content and coverage

- [ ] City statuses reviewed in `/admin`. **Nothing is marked Live that does not
      have an active community.** "Open" is the honest default and the UI prints
      that word.
- [ ] `event_sources` rows added for the launch cities
- [ ] Official facts re-checked against their sources, and `checked_at` updated
- [ ] `isSeededData` in `src/server/db/index.ts` returns false only once the
      content is real. While it is true the app carries a standing "sample city
      data" notice, which is correct and must not be switched off early.

## 6. Safety

- [ ] `STUDENTOS_DEMO_PASSWORD` **unset** in production
- [ ] Test accounts isolated to staging
- [ ] Terms and privacy pages published and linked from the footer
- [ ] Cookie handling reviewed for the jurisdictions you launch in. The product
      sets exactly one cookie, `studentos_session`, which is strictly necessary,
      so a banner is likely not required — confirm rather than assume.
- [ ] Rate limits reviewed in `src/server/rate-limit.ts`. They are per-process;
      behind more than one instance, put a shared limiter in front.
- [ ] Reports (`content_reports`) have somebody who reads them, and a documented
      response time
- [ ] Exchange safety copy present on every listing (it is not dismissible)

## 7. Operations

- [ ] `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_ENVIRONMENT` set
- [ ] PostHog set, or a deliberate decision not to
- [ ] Uptime check on `/` and on `/api/stripe/webhook`
- [ ] A deploy rollback tested once

## 8. The product itself

- [ ] `pnpm check` green: typecheck, lint, unit tests, production build
- [ ] `pnpm test:e2e` green on both the mobile and the desktop project
- [ ] Walked by hand on a real phone at 375px: sign-up, onboarding, Home,
      LifeOps, an event, Anyone Down?, a Pulse post, Ask, Budget, Exchange
- [ ] No dead buttons. Every control either navigates, mutates, or says plainly
      that its integration is not connected.
- [ ] Lighthouse on `/` and `/home` — check the numbers rather than assuming

---

## What is deliberately not on this list

**A background job runner.** Notifications are computed when a student opens
Home, written after the response is sent, and deduplicated by a stable key.
Recurring charges are surfaced by their next due date rather than expanded into
transaction rows. Both are honest, both work without a scheduler, and both would
be better with one — but neither blocks a launch.

**Push notifications.** There is no service worker and no subscription flow.
`push_subscriptions` exists in the schema and nothing writes to it. The in-app
inbox is real; push is not, and nothing in the UI claims otherwise.

**Image upload.** There is no file storage, so Pulse posts, chat and Exchange
listings are text and references only. A picture button with nothing behind it
would be worse than its absence.

**Realtime.** Chat polls on a visibility-aware interval. It is not labelled
"live" anywhere, because it is not.
