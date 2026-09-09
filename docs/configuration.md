# Configuration

Everything you have to set up outside this repository, what it turns on, and
whether you need it before a launch.

The product runs with **none** of it configured: a JSON-backed store seeded with
sample city content, deterministic AI answers, no billing, and a standing notice
saying so. That is the point — nothing here is required to evaluate the product,
and every unconfigured integration says it is unconfigured rather than
pretending.

| Service | Required for MVP? | What breaks without it |
|---|---|---|
| Supabase | **Yes** | Data does not survive a restart. |
| Google OAuth | No | Google button is replaced by an honest note. |
| AI provider | No | Answers are written by the product, not a model. |
| Stripe | Only to take money | Upgrade screen says billing is not connected. |
| Resend | **Yes, before public signup** | Verification links are shown on screen instead of emailed. |
| Sentry | Recommended | No error reporting. |
| PostHog | No | No product analytics. |
| Maps tiles | No | The map renders from our own rows, which is the default anyway. |

---

## Supabase

**Why.** Storage. With these set, every read and write goes to the Postgres row
store in `src/server/db/supabase-store.ts`; without them it goes to a JSON file
that is wiped on every restart on a serverless host. `docs/data-layer.md` is the
full account of how it works and where it stops — read that first.

**Which variables decide it:** `NEXT_PUBLIC_SUPABASE_URL` **and**
`SUPABASE_SERVICE_ROLE_KEY`. The anon key is deliberately not part of the test.

**Environment**

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

**Dashboard**

1. Create a project. Choose the region closest to your students.
2. SQL Editor → run `supabase/migrations/0005_row_store.sql`. That is the one
   the application speaks.
3. Do **not** run `0001`–`0004`. They describe the relational schema the product
   is heading for, table by table, and nothing reads them yet; applying them
   creates empty tables that will mislead the next person who looks. The same
   goes for the `postgis`, `vector` and `pgcrypto` extensions — nothing needs
   them until a table is promoted to that schema.
4. Settings → API → copy the URL, the anon key and the service role key.
5. Authentication → URL Configuration → set the Site URL to your domain and add
   `https://<your-domain>/api/auth/google/callback` to the redirect allow-list.
6. Database → Backups → confirm point-in-time recovery is on before launch.

**Verify, do not assume.**

```bash
pnpm db:verify
```

It writes a probe row, reads it back, requires a deliberately stale write to be
refused, and cleans up. Variables being set proves nothing on its own: the
migration may not be applied, the key may be the wrong one, or the project may
be paused, and all three produce a deployment that looks connected.

**Authorisation, stated plainly.** The row store has RLS on with no policies, so
nothing but the service role can read it, and the service role never leaves the
server. There is no per-row database policy separating one student from another
— `requireUserId()` and the entitlement checks in `src/server/**` are what do
that. The policies in migrations `0001`–`0004`, including
`profiles_home_point_owner_only`, are part of the schema the product is heading
for and are not in force today.

---

## Google OAuth

**Why.** "Continue with Google" on sign-in and sign-up. Without both variables
the button is not rendered at all and a one-line note explains why — there is no
dead button.

**Environment**

```
GOOGLE_CLIENT_ID=<client id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<client secret>
```

**Dashboard** — Google Cloud Console → APIs & Services → Credentials

1. Configure the OAuth consent screen. External, with the `email` and `profile`
   scopes. Nothing else is requested.
2. Create Credentials → OAuth client ID → **Web application**.
3. Authorised JavaScript origins:
   - `https://<your-domain>`
   - `http://localhost:3000` (development)
4. Authorised redirect URIs:
   - `https://<your-domain>/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback`
5. If you put Supabase Auth in front instead, use Supabase's provider settings
   and point Google at `https://<project>.supabase.co/auth/v1/callback`.

---

## AI provider

**Why.** The written sentence over an answer the product has already computed.
Retrieval, ranking, budgeting, the daily brief, LifeOps and the mission builder
are all Tier 0 — no model is called for any of them, which is why the free tier
is affordable. A model can never add a place, change a price, invent an event,
or state a legal requirement; `runAi` rejects the `official` domain before a
request is built.

**Environment**

```
OPENAI_API_KEY=<key>           # implies AI_PROVIDER=openai
ANTHROPIC_API_KEY=<key>        # implies AI_PROVIDER=anthropic
AI_PROVIDER=openai             # only needed when both keys are present
AI_API_KEY=<key>               # any other OpenAI-compatible endpoint; wins over both
AI_MODEL=                      # optional: pins one model across every tier
AI_BASE_URL=                   # optional: self-hosted OpenAI-compatible gateway
```

A vendor key implies its own provider, and the key handed to the request is
always the one belonging to the resolved provider — a mismatch degrades to
deterministic answers rather than sending one vendor's key to the other's
endpoint. `/admin` → Services names both the provider and the variable the key
came from.

**Where to get it.** OpenAI: platform.openai.com → API keys. Anthropic:
console.anthropic.com → API keys.

**Set from /admin, not the environment.** Provider, the model for each tier,
temperature, per-tier output ceilings, a daily and monthly euro spend cap, and a
per-user daily call cap. Past a cap every answer falls back to the deterministic
one and the UI says so in one line. The API key is deliberately not settable
from the admin form: a secret you can type into a web page is a secret in a
database backup.

**Default models** — tier 1 `claude-haiku-4-5-20251001`, tier 2
`claude-sonnet-5`, tier 3 `claude-opus-5` (Max only). Change per tier in /admin.

---

## Stripe

**Why.** Plus, Pro and Max. Entitlements are enforced server-side from the
subscription row, never from a cookie, a URL or a prop, so a missing Stripe
config means nobody can pay — not that everybody gets everything.

**Environment**

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PLUS_MONTHLY=price_...
STRIPE_PRICE_PLUS_ANNUAL=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
STRIPE_PRICE_MAX_MONTHLY=price_...
STRIPE_PRICE_MAX_ANNUAL=price_...
```

**Dashboard**

1. Products → create three products (Plus, Pro, Max), each with a monthly and an
   annual price. Copy the six price ids.
2. Developers → Webhooks → add an endpoint at
   `https://<your-domain>/api/stripe/webhook`.
3. Send these events: `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_failed`.
4. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`. The route refuses
   unsigned requests and has no development bypass.
5. Settings → Billing → Customer portal → enable it, and allow plan changes and
   cancellation.
6. Test with `stripe listen --forward-to localhost:3000/api/stripe/webhook` and
   card `4242 4242 4242 4242`.

---

## Resend (email)

**Why.** Email verification and password reset. **While this is unset the app
shows the verification link on screen instead of emailing it**, which is
convenient in development and unacceptable in production — anyone who can reach
the signup page can verify any address.

**Environment**

```
RESEND_API_KEY=re_...
RESEND_FROM="StudentOS <hello@your-domain>"
```

**Dashboard.** resend.com → Domains → add your domain → add the SPF, DKIM and
DMARC records it gives you → wait for verification → API Keys → create a sending
key.

---

## Sentry, PostHog

Both no-op when unset.

```
NEXT_PUBLIC_SENTRY_DSN=https://...ingest.sentry.io/...
SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com
```

Use the EU PostHog host if your students are in Europe.

---

## Maps

Discover draws from our own rows on a stylised canvas. No third-party tiles are
requested, so nothing about where a student is looking leaves the server. A key
opts into a tile provider for signed-in surfaces only.

```
NEXT_PUBLIC_MAPS_PROVIDER=
MAPS_API_KEY=
```

If you enable one, restrict the key by HTTP referrer to your domain, and set a
billing budget alert — an unrestricted Maps key is the most commonly abused
credential on the internet.

---

## Event sources

`supabase/migrations/0003_operations.sql` creates `event_sources`. Each row is a
public feed the source itself publishes — a university calendar, a city open
data set. Two connector kinds are supported: `ical` and `madrid-agenda`.

Add rows through the Supabase table editor with the feed URL, the city, a label,
and `trust` set to `official` or `venue`. Nothing is scraped, and every ingested
event carries its source so the UI can print it.

---

## Admin

```
ADMIN_EMAILS=you@example.com,cofounder@example.com
```

Comma-separated. In the environment rather than a database flag on purpose:
promoting yourself to admin should require a deploy, not a row edit. `/admin` is
not linked from anywhere in the product and redirects non-admins rather than
returning 403 — a 403 confirms the route exists.

---

## Demo account

```
STUDENTOS_DEMO_PASSWORD=<a password you choose>
```

Creates `demo@studentos.local` with a full account on first seed: budget with
transactions, a LifeOps timeline, a mission in progress, friends, a shared plan,
saved places, and exchange listings.

**There is no default and there must never be one.** A seeded account with a
known credential is a real account with a published password. Set it in
development and in a staging environment; never in production.
