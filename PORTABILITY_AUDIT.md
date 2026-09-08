# Portability audit

**Question this answers:** what does StudentOS currently need from one specific
Windows PC, and what would break if that PC disappeared this afternoon?

Audited on 2026-09-08 against commit `f68eb99` on `main`. Nothing was changed
while auditing. Every finding below is classified as:

- **already cloud** - nothing on this machine is in the loop, leave alone
- **must move** - the same thing, hosted or committed instead of local
- **must replace** - no hosted equivalent exists, it needs a different mechanism

The headline: the *code* is in unusually good shape for this. There is no local
database, no Docker, no resident worker, no tunnel and no absolute path anywhere
in the tree. What ties the product to this PC is not the source, it is the
**operations**: production is deployed by hand from this laptop, holds one
environment variable, and stores every account in a temporary directory that the
next deploy erases.

---

## Summary table

| # | Finding | Class | Fix |
|---|---|---|---|
| A1 | Repo exists and everything is pushed | already cloud | none |
| A2 | No secret in git history | already cloud | none |
| A3 | Repo is **public**, brief requires private | must move | flip visibility, founder confirms |
| A4 | `.gitignore` misses Supabase CLI and editor droppings | must move | extend it |
| A5 | Working copy sits in an ephemeral scratch workspace | must move | clone to a durable path |
| B1 | No local Supabase stack, no Docker | already cloud | none |
| B2 | Production stores accounts on the instance temp disk | must move | hosted Supabase plus env vars |
| B3 | Schema is entirely in `supabase/migrations` | already cloud | apply `0005` to the hosted project |
| B4 | Runtime file writes exist in the JSON store only | must replace | row store in production |
| B5 | `.data/` holds 504 KB of local dev data | already cloud | leave, never delete unasked |
| B6 | No user uploads, no generated files on disk | already cloud | none |
| C1 | No absolute machine paths anywhere | already cloud | none |
| C2 | `localhost` only in dev tooling and docs | already cloud | none |
| C3 | No `VERCEL_URL` fallback for preview deploys | must move | add fallback in `env.ts` |
| D1 | No cron, no resident worker, no Task Scheduler entry | already cloud | none |
| D2 | Nothing prunes expired sessions, tokens or usage rows | must replace | `pg_cron` migration |
| D3 | `syncProvider()` exists with **no caller at all** | must replace | Vercel Cron route |
| E1 | Stripe webhook route exists, endpoint never registered | must move | founder registers it |
| F1 | Vercel holds exactly one variable | must move | push the full set |
| F2 | `.env.example` does not say which environment needs what | must move | rebuild it |
| G1 | No Redis, no tiles, no models, no global CLI shell-outs | already cloud | none |
| G2 | `web-push` is a dependency imported nowhere | must move | remove |
| H1 | Vercel project exists, region already `fra1` | already cloud | none |
| H2 | **Every production deploy was made from this PC** | must move | connect GitHub to Vercel |
| H3 | CI exists but runs with no declared env | must move | add public placeholders |
| H4 | No health endpoint, no backups | must replace | add both |
| I1 | `engines.node` says `>=20`, which cannot run `pnpm test` | must move | correct to `>=24` |
| I2 | No devcontainer | must move | add one |
| J1 | `CLAUDE.md` is a one-line include, no project guidance | must move | write it |
| J2 | README production section is stale | must move | rewrite |
| J3 | No `DECISIONS.md` | must move | create |

---

## A. Source control

**A1. There is a repo and it is current.** `origin` is
`https://github.com/RRORUMAN/studentos.git`. `main` is clean, tracks
`origin/main` and is level with it; `launch-readiness` is merged and also
pushed. 435 tracked files, 1.4 MB on GitHub. Nothing is uncommitted and nothing
is unpushed. *Already cloud.*

**A2. No secret has ever been committed.** Scanned every commit reachable from
every ref for `sk_live_`, `sk_test_`, `whsec_`, `re_...`, `service_role`,
`eyJ...` and PEM private key headers. Every hit is one of three harmless things:
documentation placeholders (`STRIPE_WEBHOOK_SECRET=whsec_...`), SQL `grant ...
to service_role` in migration 0005, or a base64 integrity hash in
`pnpm-lock.yaml`. The only `.env` file ever added to the index is
`.env.example`. `gitleaks` is not installed on this machine; the grep above is
the substitute and it is clean. **No key needs rotating on account of git
history.** *Already cloud.*

**A3. The repository is public.** The brief requires a private repository. The
existing repo carries the entire history, the CI workflow and the remote every
machine would clone from, so the sane fix is to flip `RRORUMAN/studentos` to
private rather than create a second, differently spelled repository. It has no
forks, no stars and no watchers, so nothing downstream breaks. Changing
visibility is outward facing, so it waits for the founder. *Must move.*

**A4. `.gitignore` is good but incomplete.** It already covers `node_modules`,
`.next`, `out`, `build`, `coverage`, `.env*` with a `!.env.example` exception,
`.vercel`, `*.tsbuildinfo`, `.data/` and the Playwright artefact directories.
Missing: `supabase/.temp`, `supabase/.branches`, `*.log`, `Thumbs.db`,
`.idea/`, `.turbo/`. *Must move.*

**A5. The working copy lives somewhere temporary.** This checkout sits inside a
Claude Code scratch workspace, which is deleted when the session ends. Because
everything is pushed, that costs nothing today, but it is not a home. The fix is
a founder task, not a code change: clone the repo to a durable path such as
`C:\Users\<you>\code\studentos`. *Must move.*

---

## B. Database, schema and storage

**B1. There is no local database of any kind.** No `supabase/config.toml`, so
`supabase start` has never been run here. No `supabase link` state. Docker is not
installed at all, so a local Supabase stack is not merely unused, it is
impossible. No SQLite, no local Postgres, no Redis. *Already cloud.*

**B2. Production keeps accounts on a disk that gets erased.** The Vercel project
`studentos` has exactly one environment variable set, `NEXT_PUBLIC_SITE_URL`.
`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are unset, so
`isRowStoreConfigured` in `src/services/env.ts` is false, so
`src/server/db/access.ts` selects the JSON file store, which on Vercel writes to
`os.tmpdir()`. Every redeploy and every cold instance loses every account,
budget and message. The application is honest about this (it shows a standing
"preview server, nothing is kept" notice), which is why it is a configuration
gap rather than a bug, but it is the single biggest thing standing between this
project and "production runs entirely on managed cloud services". *Must move.*

**B3. All schema is in files.** Five migrations under `supabase/migrations`.
No hand-made changes exist anywhere, because no hosted project has ever been
connected from this machine and no local Studio has ever run. There is a trap
worth restating: **`0001` to `0004` describe a relational target that nothing
reads, and must not be applied**; `0005_row_store.sql` is the one the
application actually speaks to. A plain `supabase db push` would apply all five.
*Already cloud, with a sequencing caveat.*

**B4. Runtime file writes exist in exactly one file.** `src/server/db/store.ts`
(`mkdir`, `writeFile`, `rename`, `rm`) is the JSON fallback store. There are no
other writes: nothing writes into `public/`, no uploads directory, no generated
images, no CSV or PDF written to disk, no disk cache.
`scripts/mascot-manifest.mjs` writes a source file, but it is a developer
command, not runtime. *Must replace for production* by configuring the row
store; the file store stays as the zero-configuration development path, which is
a feature.

**B5. `.data/` holds 504 KB of local development data** (`studentos.json`, a
`.bak`, and the e2e scratch copy). Gitignored, personal, not referenced by
production. Left alone. It will not be deleted without asking. *Already cloud.*

**B6. No Supabase Storage bucket is needed yet.** Receipt scanning is gated and
priced but has no OCR provider wired and refuses honestly; share cards are
rendered, not written; the calendar export is streamed from
`/api/lifeops/calendar.ics` rather than saved. There is no local file write to
move into a bucket. Creating empty buckets now would be scaffolding for a
feature that does not exist. *Already cloud.*

---

## C. URLs and paths

**C1.** No `C:\Users`, `/Users/`, `/home/` or `~/` path in any tracked file.

**C2.** `localhost` and `127.0.0.1` appear four times in source, all correct:
a last-resort host fallback in `src/server/actions/billing.ts` (the real value
comes from the request headers), a comment about cookie `secure` flags, the
Playwright base URL on port 3311, and two documentation lines.

**C3. Preview deployments produce wrong share links.** `env.siteUrl` reads
`NEXT_PUBLIC_SITE_URL` and nothing else, falling back to the brand's canonical
URL. On a preview deployment that variable is either absent or set to the
production domain, so `.ics` links, mission share cards, `robots.txt` and
`sitemap.xml` all point at production from a preview. Vercel supplies
`VERCEL_URL` per deployment; it should be the fallback. *Must move.*

---

## D. Scheduled and background work

**D1. Nothing resident exists to dismantle.** No `node-cron` dependency, no
server-side `setInterval`, no `while (true)`, no queue worker, no Windows Task
Scheduler entry, no launchd plist, no `.bat` or `.ps1` scheduled anywhere. The
three `setInterval` calls are browser-side animation in two marketing
components. *Already cloud.*

**D2. Nothing is pruned, ever.** The other half of "no schedules" is that rows
which should expire never leave. `sessions` and `authTokens` carry `expiresAt`,
`processedStripeEvents` is an append-only idempotency ledger, and `aiUsage`
grows one row per model call forever. Nothing deletes any of them. This is
database-only work, so it belongs inside Supabase as `pg_cron` and must keep
running when Vercel is asleep. One subtlety for whoever writes it: a delete has
to bump `studentos_meta.revision` for the affected logical table, or running
instances will serve deleted rows from cache. *Must replace.*

**D3. `syncProvider()` has no caller.** `src/server/work/providers.ts` exports a
complete, careful feed sync: it fetches, deduplicates by provider id and by
shape, updates or inserts, and records a `ProviderRun` with the real error text
on failure. **Nothing in the codebase calls it.** Any feed added to
`STUDENTOS_WORK_FEEDS` would therefore never sync, and `/admin` would show a
provider that never ran. That is the exact shape of a fake integration. It needs
a scheduled caller: a `CRON_SECRET`-protected route driven by Vercel Cron.
Because `STUDENTOS_WORK_FEEDS` is unset everywhere, the honest behaviour of that
route today is to report zero configured feeds and do nothing, which is what it
should say. *Must replace.*

---

## E. Webhooks

**E1. The Stripe webhook route exists; the endpoint does not.**
`src/app/api/stripe/webhook/route.ts` is the only writer of the subscriptions
table and refuses unsigned requests with no development bypass, which is right.
But `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are unset in Vercel, and no
endpoint is registered in Stripe. There is no ngrok, localtunnel or LAN address
anywhere in the tree or the docs, so there is nothing pointing at this PC to
take down. Registering the production endpoint is a founder task. *Must move.*

**E2.** No Resend webhook is used. Resend is send-only.

---

## F. Secrets

**F1. Almost nothing is configured, but nothing is stranded either.** The full
set of names the product reads is in `src/services/env.ts`, which is the only
file that touches `process.env`. Current placement:

| Where | What is there |
|---|---|
| Vercel (production) | `NEXT_PUBLIC_SITE_URL` |
| Vercel (preview, development) | nothing |
| Supabase | no project connected from this machine |
| `.env.local` on this PC | `STUDENTOS_DEMO_PASSWORD`, `ADMIN_EMAILS` |
| Nowhere | everything else: Supabase keys, Stripe keys and six price ids, Resend, Anthropic, Google OAuth, Sentry, PostHog, Maps |

The good news is the inverse of the bad news: **no production secret exists only
on this PC**, so losing the machine loses no credential. The two local values are
development conveniences with no production meaning. *Must move* means "set them
in Vercel", not "rescue them from here".

**F2. `.env.example` lists every variable but not its habitat.** It documents
what each key turns on and what breaks without it, which is more than most
projects manage, but it does not say which of production, preview or development
needs each one, nor where the value is obtained. *Must move.*

---

## G. Local services and dependencies

**G1.** No Docker, no Redis, no Upstash, no local MapLibre tiles or datasets, no
ML models on disk, no global CLI the application shells out to. Maps are an
optional hosted API behind `MAPS_API_KEY`. *Already cloud.*

**G2. `web-push` is installed and imported nowhere.** Neither it nor
`@types/web-push` appears in any source file. Dead weight in the install and the
lockfile. *Must move* (out).

---

## H. Deployment

**H1.** Vercel project `studentos` exists under team `robins-projects-8da5a59a`,
linked through `.vercel/project.json`, which is correctly gitignored and
re-created per machine by `vercel link`. `vercel.json` already pins
`regions: ["fra1"]`, next to a Frankfurt database. *Already cloud.*

**H2. Every production deployment was made by hand from this PC.** All five
production deployments are attributed to the CLI user `rroruman-2724`, and
`GET /repos/RRORUMAN/studentos/hooks` returns an empty list, so no push has ever
triggered a deploy. Vercel's GitHub app has not been authorised, which needs the
founder in a browser. Until it is, this machine is the only thing that can ship.
*Must move.*

**H3. CI exists and is close.** `.github/workflows/ci.yml` already checks out,
sets up pnpm from `packageManager`, reads Node from `.nvmrc`, caches, installs
frozen, then typechecks, lints, tests and builds, with a second job running
Playwright against a production build. What it does not do is declare any
environment, so it proves the build works with *nothing* set rather than with
the public keys a preview would have. *Must move.*

**H4. No health endpoint and no backup.** There is no `/api/health`, so an
uptime monitor has nothing to ping and a database outage is invisible until a
student reports it. There is no copy of the data anywhere outside Supabase.
*Must replace.*

---

## I. Toolchain and a fresh machine

**I1. `engines.node` is wrong.** `package.json` declares `>=20`, but `pnpm test`
runs `node --test --experimental-strip-types`, a flag that does not exist on
Node 20. `.nvmrc` says 24, CI runs 24 and Vercel runs 24.x. The declaration
should say what is true. *Must move.*

**I2.** `pnpm-lock.yaml` is committed and `packageManager` pins `pnpm@11.25.0`,
so installs are reproducible. There is no `.devcontainer`, so a Codespace starts
from nothing. `scripts/setup.mjs` (`pnpm setup`) is already a good idempotent
first run: it checks Node against `.nvmrc`, installs frozen, writes a starter
`.env.local`, fetches Playwright browsers and then prints which services are
connected and what each absence costs. It stops short of the cloud handshakes
(`gh`, `vercel link`, `vercel env pull`, `supabase link`). *Must move.*

---

## J. Documentation

**J1. `CLAUDE.md` contains one line**, an include of `AGENTS.md`, and
`AGENTS.md` is a block that `next dev` writes and rewrites by itself. There is
no project guidance in either, and nothing about running a cloud session.
*Must move.*

**J2. The README production section is stale.** It still says the
Supabase-backed repository is "the remaining step" and directs the reader to
apply `0001_init.sql` and `0002_daily_product.sql`, which is the advice that
would break a new project. The row store shipped; `0005` is the migration that
matters. *Must move.*

**J3. There is no `DECISIONS.md`.** *Must move.*

---

## What this leaves

Four things need the founder in a browser before the remaining work can finish,
and they are listed with exact URLs and values in the founder checklist at the
end of the run:

1. Flip the repository to private (or say to create a separate one).
2. `supabase login`, then confirm or create the hosted project in Frankfurt.
3. Authorise Vercel's GitHub app so `main` deploys itself.
4. Register the Stripe webhook endpoint and hand over the signing secret.

Everything else in Phases 1, 3, 4, 5 and 6 can be built and committed without
waiting, and is.
