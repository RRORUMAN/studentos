@AGENTS.md

# StudentOS

The daily app for international students. One Next.js 16 application holding
both the marketing site and the authenticated product.

## Getting it running

```bash
./scripts/bootstrap.sh    # or scripts/bootstrap.ps1 on Windows without Git Bash
pnpm dev                  # http://localhost:3000
```

It runs with **zero environment variables**. Storage falls back to a JSON file
under `.data/`, the AI gateway falls back to a deterministic provider, and every
unconfigured integration says so in the interface. Never add a variable that has
to be set before the product will start.

## Commands

```bash
pnpm dev              # development server
pnpm test             # unit tests, Node's runner, no bundler
pnpm test:e2e         # Playwright, mobile and desktop
pnpm check            # typecheck + lint + test + build, in that order
pnpm db:verify        # proves a live Supabase project accepts writes
pnpm env:push         # push .env.local values into Vercel, one prompt each
```

`pnpm check` is what CI runs. Run it before saying something is done.

## Deploying

**Read this before you believe a push went live.** This section used to say
"Push to `main`. That is the whole procedure. GitHub deploys to Vercel" and
"nobody runs `vercel --prod` from a laptop". Neither was true. The
GitHub→Vercel integration has never been connected: there are no deployment
records on the repository, and every production release has been a laptop
running the command this file forbade. A push to `main` builds nothing on
Vercel and changes nothing in production.

So, as things actually stand:

```bash
git push origin main     # runs CI. Does NOT deploy.
vercel --prod            # deploys. This is currently the only thing that does.
```

`GET /api/health` on the deployment returns the commit it is serving, which is
the only way to know what production is actually running:

```bash
curl -s https://studentos-sooty.vercel.app/api/health
```

**The fix is to connect the integration**, in the Vercel dashboard under
Project → Settings → Git. It needs someone with dashboard access; it cannot be
done from a shell. Once it is connected, `main` deploys on push, pull requests
get previews, the two commands above collapse back into one, and this section
should go back to what it used to say — at which point it will be true.

Until then, treat "I pushed" and "it is live" as separate claims, because they
are, and check the health endpoint rather than assuming.

## Cloud sessions

A Claude Code cloud session, a Codespace or any container can be productive here
without a single secret.

Setup command:

```bash
corepack enable && pnpm install
```

That is enough for `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build`.
All four pass with nothing configured, and that is a property worth protecting:
it is what lets CI run on a fork's pull request and what lets a preview
deployment build. If a change makes the build require a secret, the change is
wrong, not the environment.

For a build that matches a preview deployment more closely, set the four public
placeholders CI uses (they are in `.github/workflows/ci.yml` and none is a
secret):

```
NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_SUPABASE_URL,
NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
```

**Never put a real secret in a cloud session.** Nothing there needs one. Real
values live in Vercel and reach a trusted machine through `vercel env pull`. A
session that needs to touch the live database is a session doing something that
should have been a migration.

`pnpm test:e2e` needs a Chromium download; skip it in a cloud session unless you
are specifically working on the flows.

## Architecture, briefly

Full detail is in `README.md`; these are the conventions that break things when
they are ignored.

- **Engines do maths, queries do I/O.** `src/server/engines/**` are pure: `now`
  is a parameter, money is integer cents, no imports that touch the network or
  the disk. `src/server/queries/**` load rows and hand them to an engine. Every
  number the product shows is testable against fixed dates and fixed rows with
  no database.
- **`src/services/env.ts` is the only file that reads `process.env`.** Anything
  else that wants a variable adds it there and to `.env.example`, with the
  `# env:` annotation that `scripts/env-push.sh` reads.
- **Entitlements are checked on the server.** `src/config/entitlements.ts` maps a
  capability to a tier; nothing asks whether the user is on Pro. Every gated
  action calls `assertFeature` before doing any work.
- **A `"use server"` module may export only async functions.** Labels, enums and
  option lists that both a client component and an action need live in
  `src/config/`. Next.js rejects anything else at runtime, and it shows up as a
  500 on every page importing the component.
- **Dates and money format explicitly.** `en-GB` for dates, the city's locale for
  money, the city's timezone for times, through `src/lib/dates.ts`. Never
  `toLocaleString` in a component: the machine rendering the page does not get to
  decide what day of the week it prints.
- **The AI layer never selects anything.** Retrieval happens first in ordinary
  code; a model only writes a sentence over an answer that is already complete.
  A model never touches the database, only the typed tools in
  `src/server/ai/tools.ts`.

## Two rules with no exceptions

**Nothing is faked.** No placeholder presented as live data, no dead button, no
integration that reports success while doing nothing. When a key is absent the
interface says so. Seeded content carries a standing notice. A real degraded
implementation beats a convincing mock, every time.

**Nothing runs on one particular machine.** No local database, no resident
worker, no scheduled task on somebody's laptop, no file written at runtime.
Schedules are Vercel Cron (application code) or `pg_cron` (rows only). Storage is
Supabase. Secrets are in Vercel. See `PORTABILITY_AUDIT.md` for how that was
arrived at and `DECISIONS.md` for why each choice is what it is.
