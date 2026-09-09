# Production setup

Every external service StudentOS talks to, what it is for, and exactly what you
have to do. `docs/configuration.md` has longer prose on several of these;
this file is the checklist you work down on the day.

**Status is as of 2026-09-07 and describes the code, not your account.** Nothing
here has been configured on your behalf — no credentials were invented and none
were available to this session. `/admin` → **Services** reports the live state
from the running process, and `pnpm db:verify` proves the database specifically.

Order matters. Storage first: until it is real, nothing else is worth
configuring, because every account you create while testing Stripe disappears on
the next deploy.

---

## 1. Supabase

**STATUS:** Missing — code complete, **never executed against a real Postgres**

The store and its tests are done and green, but no Supabase credentials existed
in the session that wrote them, so `0005_row_store.sql` has been read and
structurally checked and never actually run. Treat step 3 below as the first
real test of it, and `pnpm db:verify` as the thing that tells you whether it
worked. If the SQL editor reports an error, that is the expected kind of problem
at this point and not a sign anything deeper is wrong.

**PURPOSE**
The database. Without it the product runs on a JSON file; on Vercel that file
lives on the instance's temp disk and **every redeploy deletes every account,
budget, message and subscription**. This is the one thing that blocks a launch
outright.

**REQUIRED ENV VARIABLES**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STUDENTOS_STORE=supabase
```

**DASHBOARD SETUP**
1. supabase.com → New project. Pick the region closest to your students —
   `eu-central-1` (Frankfurt) matches the current Vercel region `fra1`.
   Create it as a **production** project, separate from anything you have been
   experimenting with.
2. Save the database password somewhere durable. You will not be shown it again.
3. SQL Editor → New query → paste the **entire** contents of
   `supabase/migrations/0005_row_store.sql` → Run.
4. Same again with `supabase/migrations/0006_scheduled_cleanup.sql`. It enables
   `pg_cron` and schedules a daily prune of expired sessions, spent auth tokens,
   the Stripe idempotency ledger and the AI usage log. Without it those grow
   forever, and two of them are hashed credentials with no remaining purpose.
5. Do **not** apply `0001`–`0004`, and do **not** run a plain `supabase db push`,
   which would apply all six. `0001`–`0004` describe the relational schema the
   product is heading for; nothing reads them, they need `postgis` and `vector`,
   and applying them creates empty tables that will confuse you later.
   `docs/data-layer.md` explains why. The two files above are the whole schema.
6. Settings → API → copy the three values into the variables above.
7. Database → Backups → enable Point-in-time recovery.

**CONFIRM THE SCHEDULE IS RUNNING**
```sql
select jobname, schedule, active from cron.job;
select jobname, status, start_time from cron.job_run_details order by start_time desc limit 5;
```
`studentos-prune` should be listed and active. The second query is empty until
it has run once.

**REDIRECT/CALLBACK URLs**
None. The store is reached server-side over HTTPS with the service role key.

**WHERE TO GET THE CREDENTIAL**
Project Settings → API. `URL` and `anon public` are safe to expose;
`service_role` is not — it bypasses row-level security. It must only ever be a
server-side variable, never prefixed `NEXT_PUBLIC_`.

**VERIFY**
```bash
pnpm db:verify
```
It writes a probe row, reads it back, confirms a deliberately stale write is
rejected, and deletes the probe. Exit code 0 means storage is genuinely real.
Anything else prints what to fix. Run it against production; it cleans up after
itself.

**REQUIRED FOR MVP?** **Yes.** Nothing else matters until this passes.

---

## 2. Resend (email)

**STATUS:** Missing

**PURPOSE**
Verification and password-reset email. Sent over Resend's REST API — this was a
stub returning `not-implemented` until 2026-09-07 and is now a real send.

**Read this part.** When email cannot be sent, sign-up falls back to putting the
verification token in the redirect, so a new account verifies its own address
immediately. Password reset falls back the same way: the link is handed to
whoever typed the address. Both are correct on a laptop with no provider and
both are account-takeover holes in public. They are reachable whenever
`RESEND_API_KEY` or `RESEND_FROM` is unset, or `NEXT_PUBLIC_SITE_URL` is
missing so no absolute link can be built. `/admin` → Services says which.

**REQUIRED ENV VARIABLES**
```
RESEND_API_KEY
RESEND_FROM        e.g.  StudentOS <hello@your-domain.com>
```

**DASHBOARD SETUP**
1. resend.com → Domains → Add your domain.
2. Add the DNS records it gives you: **SPF, DKIM and DMARC**. All three. Without
   DMARC, Gmail and Outlook will put verification mail in spam and your sign-up
   funnel will look broken for reasons you cannot see.
3. Wait for the domain to verify, then API Keys → Create, with sending
   permission only.
4. `RESEND_FROM` must use the verified domain, in the form
   `StudentOS <hello@your-domain.com>`.
5. `NEXT_PUBLIC_SITE_URL` must already be right — the links in these emails are
   built from it, and a send is refused rather than sent with a broken link.

**REDIRECT/CALLBACK URLs** None.

**WHERE TO GET THE CREDENTIAL** resend.com → API Keys.

**VERIFY** Sign up with a real address you control on the deployed site. The
email should arrive, and you should land on the app *without* being verified
until you click it. If you are verified without touching your inbox, the
fallback above is what ran.

**REQUIRED FOR MVP?** **Yes.**

---

## 3. Domain and canonical URL

**STATUS:** Partially configured — currently deployed at
`studentos-sooty.vercel.app`, no custom domain

**PURPOSE**
`NEXT_PUBLIC_SITE_URL` is read by share links, the sitemap, `robots.txt`, Open
Graph tags and the Google OAuth callback. Wrong here means every link you share
points at the wrong host.

**REQUIRED ENV VARIABLES**
```
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

**DASHBOARD SETUP**
Vercel → Project → Settings → Domains → add the domain and follow the DNS
instructions. Then set the variable to match, exactly, with no trailing slash.

**REQUIRED FOR MVP?** **Yes** — the vercel.app URL works, but every share link a
student sends will carry it, and moving later breaks those links.

---

## 4. Stripe

**STATUS:** Missing — code complete, including the webhook and idempotency guard

**PURPOSE**
Plus, Pro and Max. Entitlements are enforced server-side from the subscription
row, never from a cookie, a URL or a prop, so a missing Stripe config means
nobody can pay — not that everybody gets everything.

**REQUIRED ENV VARIABLES**
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_PLUS_MONTHLY
STRIPE_PRICE_PLUS_ANNUAL
STRIPE_PRICE_PRO_MONTHLY
STRIPE_PRICE_PRO_ANNUAL
STRIPE_PRICE_MAX_MONTHLY
STRIPE_PRICE_MAX_ANNUAL
```
All six price ids. `/admin` → Services names any that are missing.

**DASHBOARD SETUP**
1. Products → three products (Plus, Pro, Max), each with a monthly and an annual
   price. Current list prices: €7.99 / €9.99 / €14.99 per month, annual billed
   at ten months. Copy the six price ids.
2. Developers → Webhooks → add `https://your-domain.com/api/stripe/webhook`.
3. Send these events: `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_failed`.
4. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`. The route refuses
   unsigned requests and has no development bypass, so a missing secret means
   payments succeed and entitlements never arrive.
5. Settings → Billing → Customer portal → enable, allow plan changes and
   cancellation.
6. Toggle to **live mode** and repeat 1–5. Test and live have separate keys,
   separate price ids and separate webhooks.

**REDIRECT/CALLBACK URLs**
```
Webhook:  https://your-domain.com/api/stripe/webhook
Success:  /upgrade/success   (set by the app, no dashboard config)
```

**WHERE TO GET THE CREDENTIAL** dashboard.stripe.com → Developers → API keys.

**TEST BEFORE LAUNCH**
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
Then, on live keys with a real card: checkout → entitlement unlocks → portal →
cancel → access continues to period end → refund. And card
`4000 0000 0000 0341` for the failed-payment path: access should continue
through Stripe's retry window, not drop the same hour.

**REQUIRED FOR MVP?** **Yes, if you are charging on day one.** No, if you launch
free and turn on billing later — the paywalls fail closed.

---

## 5. Anthropic (Claude)

**STATUS:** Missing — code complete; the gateway calls the Messages API directly

**PURPOSE**
Fluent explanations. **The product is complete without it.** Every surface has a
deterministic path, the routing ladder keeps the overwhelming majority of work
at Tier 0 (no model call at all), and nothing invents a price, an opening hour
or a legal requirement whether or not a key is present.

**REQUIRED ENV VARIABLES**
```
OPENAI_API_KEY               implies AI_PROVIDER=openai
ANTHROPIC_API_KEY            implies AI_PROVIDER=anthropic
```
One of the two. Set both only alongside `AI_PROVIDER`, which then decides.

Optional overrides (OpenAI defaults shown; the Anthropic ladder is
claude-haiku-4-5-20251001 / claude-sonnet-5 / claude-opus-5):
```
AI_SMALL_MODEL=gpt-5.4-mini                  tier 1: classify, tag, summarise
AI_DEFAULT_MODEL=gpt-5.4                     tier 2: plans, budget coaching
AI_PLANNING_MODEL=gpt-5.5                    tier 3: rare, Max only
AI_MAX_TOKENS                                caps every tier
AI_DAILY_LIMIT_FREE / _PLUS / _PRO / _MAX    per-student daily calls
```
The defaults above are already what the code uses; you only need the key.

**DASHBOARD SETUP**
1. console.anthropic.com → API Keys → Create.
2. Billing → set a **monthly spend limit** on the Anthropic side as well. The
   app's own caps are in `/admin` (defaults €12/day, €200/month) and both should
   exist — one protects the product, the other protects the card.
3. After a week live: `/admin` → AI cost → **Tier 0 share should be above 70%**.
   Below that, something that should be arithmetic is calling a model.

**REDIRECT/CALLBACK URLs** None.

**WHERE TO GET THE CREDENTIAL** console.anthropic.com → Settings → API Keys.

**REQUIRED FOR MVP?** **No.**

---

## 6. Google OAuth

**STATUS:** Missing

**PURPOSE**
"Continue with Google". Without it the button is hidden and email/password
sign-in works normally.

**REQUIRED ENV VARIABLES**
```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

**DASHBOARD SETUP**
1. console.cloud.google.com → APIs & Services → OAuth consent screen. External.
   Fill in the app name, support email, logo and the links to your privacy
   policy and terms — Google will not verify without those two pages existing.
2. Credentials → Create credentials → OAuth client ID → Web application.

**REDIRECT/CALLBACK URLs**
```
https://your-domain.com/api/auth/google/callback
http://localhost:3000/api/auth/google/callback     (development)
```
Add both. The path is derived from `NEXT_PUBLIC_SITE_URL`, so that variable has
to be right first.

**WHERE TO GET THE CREDENTIAL** Google Cloud Console → Credentials.

**REQUIRED FOR MVP?** **No.**

---

## 7. Vercel

**STATUS:** Partially configured — project `studentos` (team
`robins-projects-8da5a59a`, region `fra1`), deployed from the CLI

**PURPOSE**
Hosting.

**DASHBOARD SETUP**
1. **Connect the GitHub repository.** This is still outstanding and needs you
   specifically: Vercel's GitHub app needs authorising by the repo owner.
   Vercel → Project → Settings → Git → Connect, choose `RRORUMAN/studentos`.
   Until then every deploy is a manual `vercel --prod` from a laptop, and there
   are no preview deployments on pull requests.

   After this, **pushing to `main` is the entire deployment procedure** and
   nobody runs `vercel --prod` again. A laptop that can deploy is a laptop whose
   loss, theft or bad afternoon is a production incident.
2. Settings → Environment Variables → add every variable from `.env.example`
   marked *required for launch*. Each entry there carries an `# env:` line
   saying which of Production and Preview needs it; `pnpm env:push` reads those
   annotations and does it for you without printing any values.
3. Point Preview at a **second Supabase project**, not the production one. A
   preview deployment pointed at the production database is a preview that can
   delete real accounts.
4. Leave `NEXT_PUBLIC_SITE_URL` **unset on Preview**. Unset, the application
   falls back to `VERCEL_URL` and each preview describes itself correctly; set,
   every preview emits share links and sitemap entries pointing at the live site.
5. Set `CRON_SECRET` on Production and Preview (`openssl rand -base64 32`).
   Vercel sends it to the scheduled routes; without it they refuse everything.

**SCHEDULED JOBS**
`vercel.json` declares them and Vercel picks them up on deploy. Today there is
one: `/api/cron/work-sync` at 04:17 UTC daily. Check it under Project → Cron
Jobs after the first deploy.

**COMMANDS YOU RUN**
```bash
vercel link                # once per machine
vercel env pull .env.local # bring the real values down
pnpm env:push              # push local values up, prompting for each
```

**VERIFY**
```bash
curl -s https://<domain>/api/health
curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/api/cron/work-sync
curl -s -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/work-sync
```
Health returns `{"ok":true,...}` with the commit sha. The unauthenticated cron
call must return `401`; the authenticated one `200`.

**REQUIRED FOR MVP?** Hosting yes, Git connection no — but do it before you have
users, because deploying a fix from a laptop at 2am is how mistakes happen.

---

## 8. Sentry

**STATUS:** Missing

**PURPOSE**
Knowing a page crashed without waiting for a student to tell you.

**REQUIRED ENV VARIABLES**
```
NEXT_PUBLIC_SENTRY_DSN
SENTRY_ENVIRONMENT=production
```

**DASHBOARD SETUP** sentry.io → new project → Next.js → copy the DSN. Set the
environment so production errors are separable from preview noise.

**REQUIRED FOR MVP?** **No**, but it is the cheapest thing on this list and the
first one you will wish you had.

---

## 9. PostHog

**STATUS:** Missing

**PURPOSE**
Funnels and retention beyond what `/admin` computes from the database.

**REQUIRED ENV VARIABLES**
```
NEXT_PUBLIC_POSTHOG_KEY
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com
```

**PRIVACY** Never send transaction descriptions, exact home locations, chat
contents or CV text. `/admin` already computes DAU/WAU/MAU, D1/D7/D30 retention
and paid conversion from the database, so PostHog is additive rather than
load-bearing.

**REQUIRED FOR MVP?** **No.**

---

## 10. Places and maps

**STATUS:** **Working with nothing configured.** Everything below is an upgrade.

**PURPOSE**
Real shops, cafés, pharmacies and libraries, at real coordinates, in every city
StudentOS lists.

**WHAT ALREADY WORKS, WITH NO KEY**
OpenStreetMap through the public Overpass API. Names, categories, coordinates,
addresses, opening hours, phone numbers and brands — real data, everywhere.
Check it yourself:

```bash
pnpm places:verify madrid berlin
```

**WHAT EACH VARIABLE ADDS**

| Variable | Adds | Required? |
| --- | --- | --- |
| `GOOGLE_PLACES_API_KEY` | Ratings, review counts, a price band | No |
| `OVERPASS_URL` | Your own OSM instance instead of the public ones | No, until you have volume |
| `ROUTING_OSRM_URL` | "8 min walk" instead of "600 m away" | No |
| `NEXT_PUBLIC_MAP_TILE_URL` | Streets under the map markers | No |

**GOOGLE PLACES — EXACT STEPS**

1. Google Cloud console → select or create a project.
2. **APIs & Services → Library** → enable **Places API (New)**. Not the legacy
   "Places API": the adapter uses `places:searchNearby` and
   `places:searchText`, which only the new one serves.
3. Enable **Routes API** on the same project if you want walking times from
   Google rather than running OSRM.
4. **Credentials → Create credentials → API key.**
5. **Restrict the key.** Application restriction: **IP addresses**, listing your
   Vercel function egress IPs — *not* HTTP referrer, because this key is used
   server-side only. API restriction: Places API (New) and Routes API, nothing
   else.
6. **Billing → Budgets & alerts.** Set one. An unrestricted Maps key in a public
   repository is one of the more expensive mistakes available.
7. Set `GOOGLE_PLACES_API_KEY` in Vercel. **Never** prefix it with
   `NEXT_PUBLIC_` — that would ship it to every browser.

**OVERPASS — WHEN AND HOW**
The public instances are volunteer-run and their usage policy asks for
moderation. The cache in front of them means a warm city costs no requests at
all, so this is not urgent on day one. When it is: run
[the Overpass Docker image](https://github.com/wiktorn/Overpass-API) against a
regional extract from [Geofabrik](https://download.geofabrik.de/), and set
`OVERPASS_URL` to `https://your-host/api/interpreter`.

**OSRM — WHEN AND HOW**
`docker run -p 5000:5000 osrm/osrm-backend` against a Geofabrik extract, then
`ROUTING_OSRM_URL=https://your-host`. The public demo at
router.project-osrm.org is **not** a default and should not be used: its usage
policy is development only.

**MAP TILES**
Any raster `{z}/{x}/{y}` template — MapTiler, Stadia, Thunderforest. Set
`NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` to whatever that provider requires. Without
tiles the map draws real markers on a plain grid, which is honest and free.
There is no default because OpenStreetMap's own tile servers are for the map on
their website and their usage policy does not cover an application.

**REQUIRED FOR LAUNCH?** **No.** Places work without any of it.

---

## 11. Event sources

**STATUS:** Adapter built. **No calendar configured.**

**PURPOSE**
Real events beyond what students post and the 32 seeded recurring facts.

**WHAT IS ACTUALLY THERE TODAY**
- Students can create events, and those are real.
- 32 seeded rows for the deep five, each a genuinely recurring thing with a real
  venue, real coordinates and a real `sourceUrl` — the Prado's free evening
  window, linking to the museum's own page saying so.
- **Every social count on those rows is zero.** They used to carry invented
  confirmations and interest, and the interface *adds* real responses to them,
  so three students going rendered as ninety-seven.

**WHAT TO DO — EXACT STEPS**

1. Open the events page of the university, student union or city culture
   department you want. Look for **"subscribe to this calendar"**, an
   **iCal/ICS** link, or a **Google Calendar** "public address in iCal format".
   Nearly all of them have one; it is how they expect to be read.
2. Copy the `.ics` URL. Check it in a browser — it should start
   `BEGIN:VCALENDAR`.
3. Add it to `STUDENTOS_EVENT_FEEDS` in Vercel, as
   `slug=citySlug=url`, comma separated. A campus can be named:
   `ucm-events=madrid@ucm=https://…`.
4. Trigger `/api/cron/event-sync` once (it needs `CRON_SECRET`) and read the
   response. It reports `imported`, `updated`, `expired`, and two honesty
   figures: `unpriced` (every calendar entry, because iCalendar has no price
   field) and `flattened` (entries with an RRULE, of which only the next
   occurrence was taken).
5. Check `/admin` → Data providers. A failing calendar shows the real error.

**WHAT IT WILL NOT DO** Expand recurrence, geocode a venue, or invent a price.
Each is documented in `PRODUCTION_DATA.md` → Events with the reason.

**REQUIRED FOR LAUNCH?** **No** — but do not mark a city Live on the strength of
its events until one exists. "Open" is the honest default and the interface
prints that word.

---

## 12. Job feeds

**STATUS:** Missing, and deliberately so

**PURPOSE**
Real job postings on the Work board.

**REQUIRED ENV VARIABLES**
```
STUDENTOS_WORK_FEEDS=slug=https://example.org/jobs.json,other=https://...
```

**SETUP** This is the only way an external source can enter the product. There
is no scraper and no crawler: a site that has not published a feed or an API has
not agreed to be republished, and its terms are not ours to reinterpret. Get a
partner or university feed, or leave this unset.

While unset, the Work board is filled by students, employers, and sample rows
that carry no real company name and no apply button — the card says plainly that
there is nobody to apply to.

**REQUIRED FOR MVP?** **No.**

---

## 13. Uptime monitoring and backups

**STATUS:** Endpoint and workflow exist; the monitor and the four secrets do not

**PURPOSE**
Knowing the site is down before a student tells you, and holding a copy of the
data somewhere Supabase cannot lose it for you.

**UPTIME MONITOR**
`/api/health` returns `{ ok, version, commit, store, database }` and answers
**503** when the database does not respond, so a monitor watching the status
code is watching something real rather than watching a route return 200 because
it was reachable.

Sign up for any of Better Stack, UptimeRobot or Cronitor and add one HTTP
monitor:

```
URL       https://<your-domain>/api/health
Interval  1 minute
Expect    HTTP 200
Alert     email, and SMS if the plan allows it
```

The endpoint is public and unauthenticated on purpose: a monitor that needs a
credential is a monitor that silently stops working the day the credential
rotates.

**BACKUPS**
Two independent copies:

1. Supabase's own, under Database → Backups. Enable Point-in-time recovery.
   That protects against a disk failing.
2. `.github/workflows/backup.yml`, weekly at 04:41 UTC on Sunday. It dumps
   roles, schema and data, gzips, encrypts with a passphrase, and keeps the file
   as a private GitHub Actions artefact for 90 days. That protects against the
   project being deleted, the account being locked, or a migration doing exactly
   what it was told to do.

The second needs four repository secrets, at
Settings → Secrets and variables → Actions:

| Secret | Where to get it |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens |
| `SUPABASE_PROJECT_REF` | the subdomain of your project URL |
| `SUPABASE_DB_PASSWORD` | the password saved when the project was created |
| `BACKUP_PASSPHRASE` | `openssl rand -base64 32`, stored in your password manager |

Until all four exist the workflow stops at its first step and names the missing
one. It never uploads an empty file that looks like a backup.

**VERIFY** Actions → Weekly database backup → Run workflow. Download the
artefact and decrypt it:

```bash
gpg --decrypt --batch --passphrase "$BACKUP_PASSPHRASE" studentos-*.sql.gz.gpg > dump.sql.gz
gunzip -t dump.sql.gz && echo "the archive is intact"
```

A backup nobody has ever restored is a hypothesis. Do this once now.

**REQUIRED FOR MVP?** **Yes**, both of them, before the first real account
exists.

---

## The order to do this in

1. **Supabase** → `pnpm db:verify` passes → deploy → sign up → redeploy → your
   account is still there. Do not skip that last step; it is the whole point.
2. **Domain** and `NEXT_PUBLIC_SITE_URL`.
3. **Resend**, with all three DNS records. Sign up with a real address and
   receive the email.
4. **`ADMIN_EMAILS`**, then open `/admin` → Services and confirm every line
   reads Ready or a Degraded you chose.
5. **Sentry**, because everything after this can fail in public.
6. **Stripe** in live mode, then one real card charged and refunded end to end.
7. **Uptime monitor and the backup secrets**, then run the backup workflow by
   hand once and actually decrypt what it produced.
8. Everything else, in whatever order you like.
