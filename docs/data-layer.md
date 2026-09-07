# The data layer

What is actually running, why it is shaped that way, and where it stops.

---

## Two stores, one interface

Every read and write in `src/server/**` goes through eight functions in
`src/server/db/access.ts`:

```
all  findOne  findMany  insert  insertMany  update  upsert  remove  transaction
```

Roughly seven hundred call sites use them, and they are written in JavaScript
predicates over arrays — `findMany("events", (row) => row.citySlug === city)`.
`access.ts` chooses which store those functions run against, from the
environment and nothing else:

| Environment | Store |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` **and** `SUPABASE_SERVICE_ROLE_KEY` | Postgres row store |
| neither | JSON file |

`STUDENTOS_STORE=supabase` forces the first and refuses to start without the
credentials, which is what a production deployment should set. `file` forces the
second, for a developer who has production credentials in their shell.

Note which two variables decide it. The **anon key is not one of them**: the
store is reached only from the server, only with the service role key. A
deployment holding a URL and an anon key has given the browser a key and given
the server nothing, and it runs on the file store.

---

## The JSON file store — `store.ts`

One file, held in memory, written with write-then-rename so a crash leaves the
previous good copy. Durable and serialised for **one Node process**, which is
what `next dev` and `next start` are.

It is the development and test default and it is why the `tests/e2e` flows are
real rather than mocked. It is not a database: no indexes, no concurrent
writers, and on a serverless host the only writable path is the instance's temp
directory, which is wiped on restart. When that is what is running,
`isEphemeralStore` puts a standing notice on every page — that notice is the
honest state of a deployment without a database, not a bug to hide.

---

## The Postgres row store — `supabase-store.ts` + `0005_row_store.sql`

One physical table, one row per record:

```sql
public.studentos_rows (tbl, id, user_id, data jsonb, created_at, updated_at)
primary key (tbl, id)
```

The store materialises a logical table, lets the caller's predicate run where it
was written to run, and turns whatever changed back into per-row
`INSERT`/`UPDATE`/`DELETE` inside one transaction.

**Writes are per row.** A student sending a chat message writes one row, not the
chat table. `rows.ts` computes the difference between the array the caller
finished mutating and the snapshot it was loaded from — that module is pure and
`tests/unit/rows.test.ts` covers it, because a change it fails to detect is a
write that silently does not happen.

**Concurrency is optimistic and checked.** Every write declares which tables it
read and the revision it believed each was at. `studentos_apply` locks those
meta rows in name order, compares, and rejects the whole change set if another
instance moved one first. The store then reloads and replays, up to six times.
Nothing lands half-applied. `pnpm db:verify` proves this by attempting a
deliberately stale write and checking that it is refused.

**Staleness is bounded.** Instances poll `studentos_revisions` — 72 tiny rows,
one round trip — and reload only the logical tables that moved. A plain read may
be up to one second behind another instance. A write always polls first, so a
read-modify-write is never based on a cache someone else has already
invalidated, and a student always sees their own write immediately.

### How a mutation knows which tables it touched

`transaction((db) => …)` receives a `Proxy`. A mutation cannot change `db.chat`
without first reading the property, so a getter is enough to see it coming —
which is why the seven hundred call sites did not have to be rewritten to
declare their tables. Reading a table without changing it still counts as
touching it: a decision made from rows that have since moved is a decision made
on stale data, and the optimistic check should catch it.

### Security posture

RLS is **on** for all three tables and there are deliberately **no policies**, so
`anon` and `authenticated` read nothing at all — including through a leaked anon
key. The only key that reaches the data is the service role, which never leaves
the server, and the six functions are `security definer` with execute granted to
`service_role` alone.

Authorisation therefore lives in the application, where `requireUserId()` and
the entitlement checks already are. That is a coherent posture — a server-only
data path — and it is written down here so nobody assumes a database policy is
protecting something it is not.

---

## Where this stops

Filtering happens in the application, so a logical table is held in memory by
the instance that reads it. Concretely:

- **Fine:** a few thousand students, a few hundred thousand rows in total. Cold
  start pulls the store in one `studentos_dump` round trip; steady state reloads
  only what moved.
- **Starts to hurt:** when one logical table passes roughly 50,000 rows.
  `chat`, `notifications`, `transactions` and `posts` get there first. The
  symptom is cold-start latency and per-instance memory, not incorrectness.
- **The fix, when it comes:** promote that one table to a real relational table
  with real indexes, behind the same eight functions. Nothing above the data
  layer changes. Migrations `0001`–`0004` describe the target schema for exactly
  this, table by table; **nothing reads them yet**, and this document is the
  place that says so.

That is the honest trade. The alternative was rewriting seven hundred predicate
call sites into SQL before anything could launch, and shipping a half-ported
data layer is how a launch loses data quietly.

---

## Operating it

```bash
pnpm db:verify
```

Writes a probe row, reads it back, tries a stale write, deletes the probe, and
exits non-zero if any of it fails. It checks the three things that actually go
wrong — migration not applied, service role cannot execute, write does not
survive a read — rather than checking that variables are set. Safe against
production: the probe lives in its own logical table and is removed in the same
run.

`/admin` → **Services** reports which store is serving the request, read from the
running process rather than from configuration.
