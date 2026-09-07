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
   With the Supabase CLI linked, `supabase db push` does the same thing.
4. Do **not** apply `0001`–`0004` yet. They describe the relational schema the
   product is heading for; nothing reads them, and applying them creates empty
   tables that will confuse you later. `docs/data-layer.md` explains why.
5. Settings → API → copy the three values into the variables above.
6. Database → Backups → enable Point-in-time recovery.

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
ANTHROPIC_API_KEY            implies AI_PROVIDER=anthropic
```
Optional overrides:
```
AI_SMALL_MODEL=claude-haiku-4-5-20251001     tier 1: classify, tag, summarise
AI_DEFAULT_MODEL=claude-sonnet-5             tier 2: plans, budget coaching
AI_PLANNING_MODEL=claude-opus-5              tier 3: rare, Max only
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
2. Settings → Environment Variables → add every variable from `.env.example`
   marked *required for launch*. Set them for **Production** and **Preview**
   separately; a preview deployment pointed at the production database is a
   preview that can delete real accounts.
3. Point Preview at a **second Supabase project**, not the production one.

**COMMANDS YOU RUN**
```bash
vercel link
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel --prod
```

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

## 10. Maps

**STATUS:** Missing

**PURPOSE**
The Discover map. Without a key, Discover falls back to the list view.

**REQUIRED ENV VARIABLES**
```
NEXT_PUBLIC_MAPS_PROVIDER=google
MAPS_API_KEY
```

**DASHBOARD SETUP** Enable only Maps JavaScript, Places and Geocoding. Restrict
the browser key by HTTP referrer to your domain, and any server key by IP.
Set a billing budget alert — an unrestricted Maps key found in a public repo is
one of the more expensive mistakes available.

**REQUIRED FOR MVP?** **No.**

---

## 11. Event sources

**STATUS:** Missing — no `event_sources` rows for any city

**PURPOSE**
Real events instead of seeded ones. Until these exist, every city's events are
sample content and the standing notice says so.

**SETUP** Add `event_sources` rows per launch city, then review
`/admin` → Cities. **Nothing should be marked Live that does not have an active
community** — "Open" is the honest default and the UI prints that word.

**REQUIRED FOR MVP?** **Yes, for any city you mark Live.**

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
7. Everything else, in whatever order you like.
