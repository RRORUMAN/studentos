# Decisions

Why the project is shaped the way it is. Each entry records the choice, the
alternative that was rejected, and the reason, so that a later reader can tell a
deliberate decision from an accident.

---

## Portability

Taken on 2026-09-08, while removing every dependency the project had on one
particular Windows PC. The evidence behind each of these is in
[`PORTABILITY_AUDIT.md`](PORTABILITY_AUDIT.md).

### 1. The existing `studentos` repository is kept, not replaced

The brief asked for a private repository named `stuentos`. There is already
`RRORUMAN/studentos` carrying the whole history, the CI workflow and the remote
that every machine clones from. Creating a second repository under a different
spelling would split the history and orphan the CI runs for no gain, so the
decision is to keep this repository and change its visibility to private. It has
no forks, stars or watchers, so nothing downstream notices.

Visibility is outward facing, so the flip itself is a founder task rather than
something done unasked.

### 2. The JSON file store stays, as the development path only

It would be simpler to delete `src/server/db/store.ts` and require Supabase
credentials to run anything. That is rejected: the ability to clone the repo and
get a working product with zero configuration is what makes a fresh machine
productive in ten minutes, and it is what lets CI build and test with no secrets
at all.

The rule instead is that production must never reach it. `STUDENTOS_STORE` is
set to `supabase` in the production environment, which makes a missing
credential fail the boot loudly rather than quietly serving a database that the
next deploy deletes.

### 3. `supabase db push` is not the deployment command for this project

Migrations `0001` to `0004` describe a relational target that no code reads.
`0005_row_store.sql` is the only one the application speaks to. A plain
`supabase db push` applies all five and creates a schema nothing uses, needing
`postgis` and `vector` extensions for tables that will stay empty.

The documented command is therefore an explicit list, and the reason is written
beside it in `PRODUCTION_SETUP.md` rather than left to be rediscovered.

### 4. Scheduled work is split by what it touches, not by convenience

Anything that only moves rows runs as `pg_cron` inside Supabase, so it keeps
running when Vercel has nothing deployed and no function is warm. Anything that
needs application code (fetching a feed, normalising it, writing through the
store's own de-duplication) runs as a Vercel Cron route, because that code
exists in TypeScript and reimplementing it in PL/pgSQL would create a second
version of the truth.

The consequence to remember: a `pg_cron` delete must bump
`studentos_meta.revision` for the logical table it touched, or running instances
will keep serving deleted rows from cache for up to `FRESHNESS_MS`.

### 5. Cron routes are added only where a real job exists

`syncProvider()` was found with no caller anywhere in the codebase, which is the
one genuine scheduled job the product has. It gets a route.

No other cron routes were invented. There is no digest email, no nightly
recompute and no batch generation in this product today, and adding empty routes
for them would be scaffolding that reads as a feature. When one of those ships,
the pattern is in `app/api/cron/work-sync/route.ts` to copy.

### 6. `NEXT_PUBLIC_SITE_URL` keeps its name; `VERCEL_URL` becomes its fallback

The brief called the variable `NEXT_PUBLIC_APP_URL`. The codebase has always
called it `NEXT_PUBLIC_SITE_URL`, it is already set in Vercel under that name,
and renaming it would touch a dozen call sites to gain nothing. The name stays.

What changes is the fallback order: the explicit variable, then `VERCEL_URL`
(which Vercel sets per deployment), then the brand's canonical URL. Without the
middle step every preview deployment emitted share links, sitemap entries and
calendar URLs pointing at production.

### 7. `engines.node` is corrected to `>=24` rather than made to pass on 20

`package.json` claimed `>=20`. `pnpm test` runs
`node --test --experimental-strip-types`, which does not exist on Node 20, so
the claim was false and a Node 20 machine would fail on its first test run
having been told it was supported. `.nvmrc`, CI and Vercel all say 24. The
declaration now says what is true.

### 8. `web-push` is removed

Installed, typed and imported nowhere in the codebase. Push notifications are
not implemented. Keeping the dependency implies a capability that does not
exist, and it costs every install and every CI run.

### 9. An unset `CRON_SECRET` closes the scheduled routes

The common convention is that a missing secret disables the check. That is how a
preview deployment ends up with endpoints anybody can trigger, and these
endpoints write rows and will eventually spend money on network calls. So
`requireCron` refuses when the secret is unset, and both failure modes answer
the same 401 body: telling an unauthenticated caller that the deployment has no
secret configured is information nobody outside is entitled to.

### 10. The health check probes, and the store contract grew a method for it

`/api/health` had a choice between answering 200 because it was reached, calling
`load()`, or asking the store for something cheap. The first is a health check
that cannot fail, which is worse than none. The second materialises the entire
database, which is the most expensive thing a cold instance does, and a health
check that costs a full dump is one somebody turns off the first time it gets
noisy.

So `StudentOsStore` gained `ping()`, and each implementation picks the smallest
round trip that would actually fail if the store were gone: a write-and-delete
for the file store, `studentos_revisions()` for Postgres, which exercises the
network, the key, the schema and the grants at once.

The response body carries `ok`, `version`, `commit` and a duration. It does not
carry the store's error text, which goes to the server log instead. The route is
public and unauthenticated, because a monitor that needs a credential is a
monitor that silently stops working when the credential rotates, and "is it up"
is all an anonymous caller should learn.

### 11. CI declares public placeholders and no repository secrets

CI proved the build worked with nothing set. It now runs with the four
`NEXT_PUBLIC_` values a preview deployment actually has, which is a more useful
thing to prove. It still references no repository secret anywhere, deliberately:
the moment CI needs one, a fork's pull request cannot be built, and the property
that the product runs unconfigured stops being enforced by anything.

The Supabase URL is set there without a service role key on purpose. That
combination selects the file store, which is exactly the half-configured state a
preview deployment has.

### 12. The weekly backup is encrypted and stops rather than pretending

Supabase takes its own backups. They protect against a disk failing, not against
the project being deleted, the account being locked, or a migration doing
precisely what it was told. So there is a second copy: `pg_dump` weekly, gzipped,
symmetrically encrypted, kept as a private GitHub Actions artefact for 90 days.

Its first step checks that all four required secrets exist and fails loudly
naming the missing one. A backup job that runs green while uploading nothing is
worse than no backup job, because somebody will believe it.

### 13. The Vercel cron schedule is daily, not hourly

Vercel's Hobby plan allows one run a day per cron job, and a schedule the plan
rejects fails the deployment rather than degrading. Daily is therefore the
schedule that works on any plan. The odd minutes (`17 4` for the Vercel job,
`11 3` for `pg_cron`) keep both off the top of the hour, where everybody else's
jobs are.

On a Pro plan, tighten the expression in `vercel.json` and nothing else changes.
