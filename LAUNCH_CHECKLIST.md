# Launch checklist

Ordered by what blocks what. `PRODUCTION_SETUP.md` has the dashboard steps
for every service named here, in the order to do them.

Anything marked **BLOCKER** means the product is not safe to put in front of the
public until it is done — not that it is missing a nice-to-have.

---

## 1. Data

The Supabase store now exists (`src/server/db/supabase-store.ts`), so this
section is configuration rather than engineering. `docs/data-layer.md` explains
the shape and where it stops.

- [ ] **BLOCKER** Supabase production project created, separate from any
      staging project
- [ ] **BLOCKER** `supabase/migrations/0005_row_store.sql` applied
- [ ] **BLOCKER** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
      `STUDENTOS_STORE=supabase` set in the Vercel **production** environment.
      Without the service role key the app silently runs on the JSON file — the
      anon key alone is not enough and is not meant to be.
- [ ] **BLOCKER** `pnpm db:verify` exits 0 against production. It writes a probe
      row, reads it back, confirms a stale write is rejected and cleans up.
- [ ] **BLOCKER** The real test: deploy, sign up, redeploy, confirm the account
      is still there. Nothing else on this page proves storage works.
- [ ] Preview deployments pointed at a **second** Supabase project. A preview
      wired to production is a preview that can delete real accounts.
- [ ] `/admin` → Services shows `Database (Supabase)` as Ready
- [ ] Authorisation reviewed as **application-level**, which is what it is. The
      row store has RLS on with no policies, so nothing but the service role
      reads anything; there is no per-row database policy protecting one student
      from another. Sign in as two accounts and confirm through the UI and the
      API that B cannot read A's budget, transactions, private plan, DM channel
      or `home_point`. The e2e suite covers the first four.
- [ ] Point-in-time recovery on
- [ ] A restore actually tested once, into a scratch project
- [ ] Migrations `0001`–`0004` deliberately **not** applied. They describe the
      relational schema the product is heading for and nothing reads them yet;
      applying them creates empty tables that will mislead whoever looks next.

## 2. Identity

- [ ] **BLOCKER** `RESEND_API_KEY` and `RESEND_FROM` set, domain verified with
      SPF, DKIM and DMARC. **When email cannot be sent, sign-up verifies its own
      address and a password reset hands the link to whoever typed the address.**
      Both fallbacks exist so the product works on a laptop; both are
      account-takeover holes in public.
- [ ] **BLOCKER** Confirmed by hand: sign up with a real address on the deployed
      site, receive the email, and check you are *not* verified until you click
      it. Being verified without touching your inbox means the fallback ran.
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
- [ ] All six `STRIPE_PRICE_*` ids set. `/admin` → Services names any that are
      missing; a missing one fails that plan's checkout rather than charging the
      wrong amount.
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
- [ ] If yes: `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` set. Either alone implies
      its provider; the per-tier model names in `.env.example` are already the
      code defaults and only need setting to override them.
- [ ] A spend limit set on the vendor's side too, not only in `/admin`. One
      protects the product, the other protects the card.
- [ ] Daily and monthly euro spend caps set in `/admin` (defaults: €12/day,
      €200/month across all users)
- [ ] Per-user daily call cap reviewed (default 40)
- [ ] `/admin` → AI cost → Tier 0 share is above 70%. Below that, something that
      should be arithmetic is calling a model.

## 5. Content and coverage

Places are no longer on this list as a blocker, and that is the change that
matters: they come from a provider and work in every city with nothing
configured. Run `pnpm places:verify <city>` for each launch city and read what
it says. What remains here is everything a provider cannot supply.

- [ ] City statuses reviewed in `/admin` → **City coverage**. **Nothing is
      marked Live that does not have an active community.** "Open" is the honest
      default and the UI prints that word. The screen shows, per city, real
      counts of students, institutions, upcoming events, open work, verified
      deals and Pulse posts — and names the weakest one.
- [ ] `pnpm places:verify` run for every launch city, exiting 0. It checks that
      rows come back, that each carries provenance, that each is inside the
      radius asked for, and that no OpenStreetMap row carries a rating something
      invented.
- [ ] Institutions imported for every launch **country**, not just Spain:
      `node scripts/import-institutions.mjs FR DE NL`. Outside Spain a student
      can only find their university if somebody submitted it.
- [ ] `node scripts/import-cities.mjs` re-run if any city was added, and its
      output read. The script prints what each name resolved to, and that print
      is the only review step between Wikidata and the map.
- [ ] Institution submissions queue in `/admin` has somebody who reads it
- [ ] Official facts re-checked against their sources, and `checked_at` updated
- [ ] Events: understood that there is **no event provider adapter**, so beyond
      the 32 seeded recurring facts and whatever students post, a city's events
      are empty. Do not market Event Radar in a city on the strength of it.
- [ ] `STUDENTOS_CONTENT_MODE` left at `sample` until the seeded events and
      deals have actually been replaced. While it is `sample` the app carries a
      standing "sample city data" notice, which is correct and must not be
      switched off early. Connecting a database does not make a seeded event
      real, which is why this is a separate declaration from the Supabase
      variables.
- [ ] Optional, in rough order of value:
      `ROUTING_OSRM_URL` (turns distances into walking times),
      `GOOGLE_PLACES_API_KEY` (adds ratings and price bands),
      `NEXT_PUBLIC_MAP_TILE_URL` (puts streets under the map),
      `OVERPASS_URL` (your own OSM instance, once you have volume).

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

- [ ] `/admin` → Services reviewed: every line Ready, or a Degraded you chose
- [ ] `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_ENVIRONMENT` set
- [ ] PostHog set, or a deliberate decision not to
- [ ] Uptime check on `/` and on `/api/stripe/webhook`
- [ ] Both cron jobs confirmed running in Vercel: `/api/cron/work-sync` (04:17)
      and `/api/cron/data-upkeep` (04:42). `CRON_SECRET` must be set or both
      refuse every request — which is the correct closed default, and also means
      an unset secret looks exactly like a working schedule that does nothing.
- [ ] A deploy rollback tested once

## 8. The product itself

- [ ] `pnpm check` green: typecheck, lint, unit tests, production build
- [ ] `pnpm db:verify` green against the production project
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
