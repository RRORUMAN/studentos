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

## New machine in 10 minutes

### Prerequisites

| | Install |
|---|---|
| Node 24 (the version in `.nvmrc`) | [fnm](https://github.com/Schniz/fnm) or [nvm](https://github.com/nvm-sh/nvm), then `fnm install && fnm use` |
| pnpm | `corepack enable` (bundled with Node; activates the version `package.json` pins) |
| GitHub CLI | [cli.github.com](https://cli.github.com) |
| Vercel CLI | `pnpm add -g vercel` |
| Supabase CLI | [supabase.com/docs/guides/local-development/cli/getting-started](https://supabase.com/docs/guides/local-development/cli/getting-started) |

Only the first two are needed to run the product. The other three are needed to
pull secrets, deploy and push migrations.

### Five commands

```bash
gh auth login
gh repo clone RRORUMAN/studentos
cd studentos
./scripts/bootstrap.sh                # scripts/bootstrap.ps1 on Windows without Git Bash
pnpm dev                              # http://localhost:3000
```

`bootstrap.sh` is idempotent. It checks Node, enables corepack, installs from
the lockfile, links the Vercel project, pulls `.env.local`, fetches the
Playwright browsers and links the Supabase project, printing what it is doing
and what to do if a step fails. It never overwrites your `.env.local` without
asking, and copies the old one aside first.

Every step after the install is best effort: the product runs with **zero
environment variables**, so a machine with none of those CLIs still gets a
working dev server. It just cannot deploy.

### Or with nothing installed at all

Open the repository in a [GitHub Codespace](https://github.com/codespaces).
`.devcontainer/devcontainer.json` brings Node 24, pnpm, `gh`, `vercel` and
`supabase`, runs the same bootstrap script and forwards port 3000.

### What does not travel with the repository

`.env*` files (except the template), the JSON store in `.data/`,
`node_modules/`, `.next/` and the Vercel link in `.vercel/`. A fresh clone boots
from the seeded sample content with no configuration. Line endings are
normalised to LF by `.gitattributes`, so Windows and Unix checkouts lint
identically.

---

## Where everything lives

Nothing that matters is on anybody's laptop. Losing a machine costs the working
copy and nothing else.

| What | Where | Notes |
|---|---|---|
| Code, migrations, workflows | GitHub, `RRORUMAN/studentos` | The only source of truth |
| Hosting and secrets | Vercel, project `studentos`, region `fra1` | `vercel env pull` reproduces `.env.local` anywhere |
| Database, auth, storage | Supabase, Frankfurt | Row store per `supabase/migrations/0005` |
| Row cleanup on a schedule | Supabase `pg_cron` | Migration `0006`, daily |
| Application jobs on a schedule | Vercel Cron | `app/api/cron/*`, listed in `vercel.json` |
| Payments | Stripe | Webhook at `/api/stripe/webhook` |
| Email | Resend | Verification and password reset |
| Crash reports | Sentry | Optional; without it a crash is only visible if reported |
| Product analytics | PostHog (EU) | Optional |
| Weekly encrypted backup | GitHub Actions artefact | `.github/workflows/backup.yml` |

There is deliberately no Redis, no queue worker, no container and no resident
process anywhere in that list.

## Deploy

Push to `main`.

Pull requests get a preview deployment. `/api/health` returns `{ ok, version,
commit }` and should be watched by an external uptime monitor. Nothing is ever
deployed from a laptop.

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
    api/          Stripe webhook, Google OAuth, waitlist, health, cron
supabase/migrations/   0005 row store + 0006 pg_cron are what production runs;
                       0001-0004 are the relational target and are NOT applied
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
pnpm db:verify        # proves a live Supabase project accepts writes
pnpm bootstrap        # set this machine up, or bring it back in line
pnpm env:push         # push .env.local values into Vercel, one prompt each
pnpm mascot:manifest  # regenerate the mascot asset manifest from disk
```

---

## Going to production

`PRODUCTION_SETUP.md` is the full procedure, dashboard by dashboard.
`LAUNCH_CHECKLIST.md` is what has to be true before students see it. The short
version:

1. **Database.** Create the Supabase project in Frankfurt and apply
   `supabase/migrations/0005_row_store.sql` and `0006_scheduled_cleanup.sql`.
   **Do not apply `0001` to `0004`**: they describe a relational target that no
   code reads yet, and they need `postgis` and `vector` for tables that would
   stay empty. Then set `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, set
   `STUDENTOS_STORE=supabase` so a missing credential fails the boot rather than
   quietly serving a database the next deploy deletes, and run `pnpm db:verify`.
2. **Email.** `RESEND_API_KEY` and a `RESEND_FROM` on a domain verified in
   Resend with SPF, DKIM and DMARC. This is a launch blocker: without it the
   verification link is shown on screen instead of sent, which means anybody can
   verify anybody's address.
3. **Payments.** Stripe keys, the six price ids, and a webhook endpoint at
   `https://<domain>/api/stripe/webhook`. The webhook is the only thing that
   grants an entitlement. `stripe listen --forward-to
   localhost:3000/api/stripe/webhook` is a local development convenience and is
   never part of how production works.
4. **Everything else** is optional and degrades honestly: `OPENAI_API_KEY` or
   `ANTHROPIC_API_KEY`, Google sign-in, Maps, Sentry, PostHog. `/admin` → Services lists what is
   configured and what each absence costs.

`.env.example` is the complete list, and every entry says which environments
need it and where the value comes from. `pnpm env:push` puts them into Vercel
without printing any of them.

Every push to `main` runs `.github/workflows/ci.yml`: typecheck, lint, unit
tests, build, then the Playwright flows against a production build. A green
check means the tree builds on a clean machine with no secrets.

### Known limits

- The row store keeps one physical table of jsonb records, so there are no
  foreign keys and no per-row RLS policies. RLS is on with no policies at all:
  nothing but the service role reads anything, and authorisation lives in the
  application. `docs/data-layer.md` explains the ceiling and the promotion path.
- The JSON store is correct for one Node process. It is the development
  fallback, and `STUDENTOS_STORE=supabase` is what stops production reaching it.
- Chat refreshes every 12 seconds while the tab is visible, and the header
  says so. With Supabase Realtime this becomes a subscription.
- Receipt scanning is gated and priced but has no OCR provider wired; the
  action refuses honestly until one is.
- There is no queue. Anything that cannot finish inside one function has no home
  yet; when it appears, it goes to Upstash QStash with a callback route, never a
  resident worker.
