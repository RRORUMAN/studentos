# StudentOS

The operating system for living abroad as a student — the marketing site and
the authenticated product, in one Next.js application.

```bash
pnpm install
pnpm dev          # http://localhost:3000, no configuration needed
```

It runs with **zero environment variables**. A JSON-backed database seeds
itself with sample city content on first boot, the AI gateway falls back to a
deterministic provider, billing reports itself as not connected, and Google
sign-in shows an honest note rather than a button that fails. See
`.env.example` for what each key turns on.

---

## Running on another device

You need Git, Node.js 20 or newer (this repo is developed on 24, see
`.nvmrc`) and pnpm. Corepack, bundled with Node up to 24, installs the exact
pnpm version pinned in `package.json`; otherwise `npm install -g pnpm` works.

```bash
corepack enable                       # once per machine
git clone https://github.com/<your-github-user>/studentos.git
cd studentos
pnpm install                          # honours pnpm-lock.yaml
cp .env.example .env.local            # optional: everything runs with no keys
pnpm dev                              # http://localhost:3000
```

A production build is `pnpm build` followed by `pnpm start`. `pnpm check`
runs typecheck, lint, unit tests and the build in one go. The Playwright
browsers for `pnpm test:e2e` are installed once with
`pnpm exec playwright install`.

Nothing personal travels with the repo: `.env*` files (except the template),
the JSON data store in `.data/`, `node_modules/` and `.next/` are ignored, so a
fresh clone boots from the seeded sample content. Line endings are normalised
to LF by `.gitattributes`, so Windows and Unix checkouts lint identically.

---

## What the product is

A daily app that answers, for a student in a new city:

| Question | Where |
|---|---|
| What can I afford today? | Home money summary, Budget, **Can I afford this?** |
| What should I do? | Quick actions, the **For You** feed, Ask |
| What's happening, what's free? | **Event radar**, Discover, **Right now** |
| Where should I go? | Discover: map plus smart feed, **Better option** swaps |
| What are students saying? | **Student Pulse**, **Students say** under every Ask answer, **Catch me up** |
| Who wants to join? | **Anyone Down?**, event and plan chats, friends |
| What do I need to sort out? | **Arrival Mode** timeline and the **first-week plan** |

Navigation is five destinations on mobile — Home · Discover · Ask · Pulse · You —
and six on desktop with Ask as a standing control.

---

## Architecture

```
src/
  brand/          brand + mascot config — rename the product in one line
  config/         pricing, entitlements, onboarding, arrival plan, regions
  data/           cities (deep records + worldwide directory), places
  domain/         pure types and rules: lifecycle, knowledge, social, insight
  server/
    engines/      pure functions, no I/O — budget, recommend, feed, brief,
                  afford, better-option, week, first-week, catch-up, right-now,
                  survival, savings, ask
    queries/      I/O, no maths — loads rows and hands them to the engines
    actions/      server actions; every gated one re-checks entitlements
    ai/gateway    the single door every model call goes through
    auth/         sessions, password auth, Google OAuth (PKCE)
    db/           JSON store (default) + seed content
    billing/      Stripe
  app/
    (marketing)/  public site
    (auth)/       sign-up, sign-in, reset
    (app)/        the product, its own shell
    p/[id]        public shared plans
    api/          Stripe webhook, Google OAuth, waitlist
supabase/migrations/   production schema: PostGIS, pgvector, RLS
tests/unit/            engine tests (Node's test runner, no bundler)
tests/e2e/             Playwright, mobile + desktop
```

The **engine / query split** is the load-bearing convention: engines do maths
and no I/O, queries do I/O and no maths. Every number the product shows is
testable against fixed dates and fixed rows with no database.

Two smaller conventions that have bitten before:

- A `"use server"` module may export **only async functions**. Labels, enums
  and option lists that both a client component and an action need live in
  `src/config/` (for example `src/config/feedback.ts`), never beside the action.
  Next.js rejects anything else at runtime, and the failure shows up as a 500 on
  every page that imports the component.
- Dates and money are formatted with an explicit locale (`en-GB` for dates,
  the city's locale for money), never the server's default. The machine that
  renders a page should not decide what day of the week it prints.

---

## Four rules the code enforces

**1. Nothing is invented.** The AI gateway never selects anything. Retrieval
happens first in Tier 0 code; a model only writes a sentence over a complete
answer. Immigration, residency, healthcare and tax questions are refused by the
gateway and answered from `official_facts` rows that cannot exist without a
source URL and a checked date. A city with no local price data says so instead
of printing a figure.

**2. Entitlements are server-side.** `src/config/entitlements.ts` maps a
*capability* to a tier; nothing asks "is the user on Pro?". Every gated action
calls `assertFeature` before doing any work. Paywalls are value-first: one per
screen at most, saying what the feature would show, never a padlock. Soft
limits are announced before they are hit.

**3. The private stays private.** `homePoint` is never on the `Viewer` object,
never sent to a client component, and readable only through one function that
returns a *distance*. Chat, plan and invite access is decided by one predicate
(`canReadChannel`) used by both the list and the write. RLS enforces the same
in Postgres.

**4. Nothing is faked.** Sample content carries a standing notice. Unconfigured
integrations say so in the UI. The mascot uses a rendered asset only when one is
declared on disk.

---

## Plans

| | Free €0 | Plus €7.99 | Pro €9.99 | Max €14.99 |
|---|---|---|---|---|
| Position | Get started | Save more | Run your student life | Everything, everywhere |
| Smart asks / week | 8 | 200 | 500 | 1,500 |
| Community, chat, friends, Anyone Down? | ✓ | ✓ | ✓ | ✓ |
| Budget, Safe Today, Can I afford this? | ✓ | + alternatives | + forecast | + multi-currency |
| Budget coach, receipts, Survival Mode, weekly planner | | ✓ | ✓ | ✓ |
| Forecasting, group plans and voting, shared budgets, trips | | | ✓ | ✓ |
| Many cities, relocation, long-term history | | | | ✓ |

Prices, names, Stripe price ids and the comparison matrix live in
`src/config/pricing.ts`; feature → tier in `src/config/entitlements.ts`.
Upgrade triggers (`upgradeTriggerMeta`) record the moments an upsell was shown
so admin can see which convert.

---

## Cities

Five cities have full local data: Madrid, Barcelona (live), London, Amsterdam,
Berlin (beta). The directory (`cityDirectory`) adds every city in
`src/config/regions.ts` — Paris, Rome, Lisbon, Vienna, Prague, Warsaw, Dublin,
Copenhagen, Stockholm, New York, Toronto, Sydney, Tokyo, Seoul, Singapore and
more — as **Coming soon**: currency, locale, timezone and languages are real;
budget, planner and Arrival Mode work from day one; local places and events
fill in as students add them. Admin can set a city's status (Coming soon ·
Beta · Live · High density) without a deploy.

---

## Mascot

The character is a black French Bulldog in black rectangular glasses, "the
student who already figured the city out". `src/brand/mascot.config.ts` holds
the fifteen states, the microcopy library, accessories, motion tokens and the
asset manifest. `MascotArt` renders the vector character everywhere and
switches to a rendered image per state only when one is declared — drop
renders into `public/brand/mascot/` and run `pnpm mascot:manifest`.

---

## Cost model

| Tier | What runs | Examples |
|-----|-----------|----------|
| **0** | No model at all | Budget maths, feed ranking, recommendation scoring, the brief, quick actions, Can I afford this, Survival Mode, Right now, Catch me up, the whole Home screen |
| 1 | Small model | Classification, one-line summaries |
| 2 | Mid model | Weekend planning narration, budget coaching |
| 3 | Strong model | Rare, Max-only deep planning |

Home costs nothing to serve. Admin shows **Tier 0 share** as a first-class
metric.

---

## Commands

```bash
pnpm dev              # development
pnpm test             # unit tests, Node test runner
pnpm test:e2e         # Playwright flows, mobile + desktop
pnpm check            # typecheck + lint + test + build
pnpm mascot:manifest  # regenerate the mascot asset manifest from disk
```

---

## Going to production

### Hosting

The app is a standard Next.js build with no custom server, so any Node host
works. On Vercel, import the GitHub repository and accept the defaults: the
framework preset is Next.js, the install command is `pnpm install` (pnpm is
detected from `packageManager`) and the Node version follows `.nvmrc`. Paste
the keys you use from `.env.example` into the project environment settings;
none are required for a first deploy. Elsewhere, run `pnpm build` then
`pnpm start`, and set `NEXT_PUBLIC_SITE_URL` to the public origin so share
links and the sitemap are correct.

Every push to `main` runs `.github/workflows/ci.yml`, which typechecks, lints,
runs the unit tests, builds, and runs the Playwright flows against a production
build. A green check on the commit means the tree builds on a clean machine.


1. Create a Supabase project and run `supabase/migrations/0001_init.sql` then
   `0002_daily_product.sql`. They need the `postgis`, `vector` and `pgcrypto`
   extensions.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   **The Supabase-backed repository is the remaining step**: every read and
   write goes through six functions in `src/server/db/store.ts`, so that is the
   surface to implement. The "sample city data" notice stays until the app is
   answering from a real database.
3. Google sign-in: create an OAuth "Web application" client, set
   `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, and add
   `https://<host>/api/auth/google/callback` as a redirect URI. With Supabase
   Auth in front, configure the provider there and point Google at
   `https://<project>.supabase.co/auth/v1/callback` instead.
4. Add Stripe keys and the six price ids (`STRIPE_PRICE_{PLUS,PRO,MAX}_{MONTHLY,ANNUAL}`).
   Point the webhook at `/api/stripe/webhook`; it is the only writer of the
   subscriptions table.
5. Add `RESEND_API_KEY` so verification and reset links are emailed.
6. Set `ADMIN_EMAILS` for the admin surface.

### Known limits

- The JSON store is correct for one Node process. It is the development
  fallback, not a production database.
- Chat refreshes every 12 seconds while the tab is visible, and the header
  says so. With Supabase configured this becomes a Realtime subscription.
- Receipt scanning is gated and priced but has no OCR provider wired; the
  action refuses honestly until one is.
