-- ===========================================================================
-- 0005 — THE ROW STORE
-- ---------------------------------------------------------------------------
-- What this is, stated plainly, because the previous four migrations describe
-- something else.
--
-- 0001–0004 declare the *target* relational schema: a real table per concept,
-- with foreign keys, check constraints and per-row RLS policies. That schema is
-- the right destination and it is not what the application currently speaks to.
-- Every read and write in `src/server/**` goes through eight generic functions
-- in `src/server/db/store.ts` (`all`, `findOne`, `findMany`, `insert`, `update`,
-- `upsert`, `remove`, `transaction`) whose filters are JavaScript predicates.
-- Roughly seven hundred call sites use them. Rewriting all of those into SQL is
-- a large, staged piece of work; leaving storage on a JSON file that a redeploy
-- deletes is not something to launch on.
--
-- So this migration adds the layer that makes the product durable today:
-- one physical table holding one row per record, keyed by (logical table, id),
-- with the record itself as jsonb. The application keeps its existing
-- predicates; the store loads a logical table and filters in process, and every
-- write is a real per-row INSERT/UPDATE/DELETE inside one transaction.
--
-- What that buys: data survives a redeploy, several instances can serve the
-- same deployment, writes are per-row rather than per-file, and every record is
-- queryable from SQL for the admin surfaces.
--
-- What it does not buy, and nobody should claim it does: per-row RLS policies
-- expressed in the database, foreign keys, or index-backed filtering. Those
-- arrive when a logical table is promoted to a real one — which this design
-- leaves open, table by table, behind the same eight functions.
--
-- Security posture, therefore: RLS is ON and there are deliberately NO
-- policies, so `anon` and `authenticated` can read nothing at all. The only key
-- that can touch these tables is the service role, which never leaves the
-- server. Authorisation lives in the application, where `requireUserId()` and
-- the entitlement checks already are. That is a coherent posture — a
-- server-only data path — and it is stated here so nobody assumes a policy is
-- protecting something it is not.
-- ===========================================================================

/* --------------------------------------------------------------------------
   Storage
   -------------------------------------------------------------------------- */

create table if not exists public.studentos_rows (
  tbl        text        not null,
  id         text        not null,
  /* Denormalised out of `data` on write so the admin surfaces and any future
     per-user policy have something indexed to stand on. Null where the record
     does not belong to one student (a city event, an official fact). */
  user_id    text,
  data       jsonb       not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tbl, id)
);

create index if not exists studentos_rows_tbl_idx
  on public.studentos_rows (tbl);

create index if not exists studentos_rows_tbl_user_idx
  on public.studentos_rows (tbl, user_id)
  where user_id is not null;

create index if not exists studentos_rows_updated_idx
  on public.studentos_rows (updated_at desc);

/* Containment queries (`data @> '{"city":"barcelona"}'`) for admin reporting.
   jsonb_path_ops is about half the size of the default and enough for @>. */
create index if not exists studentos_rows_data_idx
  on public.studentos_rows using gin (data jsonb_path_ops);

/* --------------------------------------------------------------------------
   Freshness
   ----------------------------------------------------------------------------
   One row per logical table carrying a revision that the apply function bumps.
   An instance polls this (72 tiny rows, one round trip) and reloads only the
   logical tables whose revision moved, instead of reloading everything or
   trusting a cache that another instance has already invalidated.
   -------------------------------------------------------------------------- */

create table if not exists public.studentos_meta (
  tbl        text        primary key,
  revision   bigint      not null default 1,
  row_count  integer     not null default 0,
  updated_at timestamptz not null default now()
);

/* A single-row marker saying the store has been initialised. Its absence is
   what tells the application to run the seeder; without it, an empty database
   and a seeded-then-emptied database look identical. */
create table if not exists public.studentos_store_state (
  id            boolean     primary key default true,
  schema_version integer    not null,
  seeded_at     timestamptz not null default now(),
  constraint studentos_store_state_single check (id)
);

alter table public.studentos_rows        enable row level security;
alter table public.studentos_meta        enable row level security;
alter table public.studentos_store_state enable row level security;

/* No policies, on purpose. See the header. The service role bypasses RLS; every
   other role — including a leaked anon key — reads and writes nothing. */

revoke all on public.studentos_rows        from anon, authenticated;
revoke all on public.studentos_meta        from anon, authenticated;
revoke all on public.studentos_store_state from anon, authenticated;

/* --------------------------------------------------------------------------
   Read: one round trip for a cold start
   ----------------------------------------------------------------------------
   PostgREST would page a large store a thousand rows at a time. A cold
   serverless instance doing two hundred round trips before it can render is
   not a cold start anybody would accept, so the whole store comes back as one
   jsonb document built in the database.

   `p_tables` null means every table; passing a list is the incremental refresh
   path, used when the revision poll says only two tables moved.
   -------------------------------------------------------------------------- */

create or replace function public.studentos_dump(p_tables text[] default null)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    jsonb_object_agg(t.tbl, t.rows),
    '{}'::jsonb
  )
  from (
    select
      r.tbl,
      jsonb_agg(
        jsonb_build_object('k', r.id, 'v', r.data)
        order by r.created_at, r.id
      ) as rows
    from public.studentos_rows r
    where p_tables is null or r.tbl = any(p_tables)
    group by r.tbl
  ) t;
$$;

/* Revisions for every logical table. Deliberately its own function rather than
   a PostgREST select so the grant surface stays to these four functions. */
create or replace function public.studentos_revisions()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_object_agg(m.tbl, m.revision), '{}'::jsonb)
  from public.studentos_meta m;
$$;

/* --------------------------------------------------------------------------
   Write: one transaction, or nothing
   ----------------------------------------------------------------------------
   `p_changes` is the change set the application computed by diffing the
   in-memory tables it touched against the snapshot it loaded:

     [ {"op":"insert","tbl":"chat","id":"…","user_id":"…","data":{…}},
       {"op":"update","tbl":"posts","id":"…","user_id":"…","data":{…}},
       {"op":"delete","tbl":"votes","id":"…"} ]

   `p_expect` is optimistic concurrency: the revision this instance believed
   each touched table was at. If another instance has since written to one of
   them, the whole call is rejected with `{"ok":false,"conflict":[…]}` and the
   caller reloads those tables and replays its mutation. Nothing is applied on
   a conflict, so a losing writer never lands half its change set.

   Returning a conflict rather than raising is deliberate: a retry is ordinary
   control flow here, not an error worth an exception and a stack trace.
   -------------------------------------------------------------------------- */

create or replace function public.studentos_apply(
  p_changes jsonb,
  p_expect  jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  change      jsonb;
  touched     text[] := '{}';
  conflicts   text[] := '{}';
  expect_tbl  text;
  expect_rev  bigint;
  current_rev bigint;
begin
  if jsonb_typeof(p_changes) <> 'array' then
    raise exception 'studentos_apply: p_changes must be a json array';
  end if;

  /* Lock the touched tables' meta rows in a stable order before checking any
     revision, so two writers cannot both pass the check and then interleave.
     Ordering by name is what stops those two writers deadlocking each other. */
  for expect_tbl in
    select key from jsonb_each(p_expect) order by key
  loop
    select revision into current_rev
    from public.studentos_meta
    where tbl = expect_tbl
    for update;

    expect_rev := (p_expect ->> expect_tbl)::bigint;

    /* No meta row yet means the table has never been written. Expecting 0 is
       the correct belief in that case; expecting anything else is stale. */
    if coalesce(current_rev, 0) <> expect_rev then
      conflicts := conflicts || expect_tbl;
    end if;
  end loop;

  if array_length(conflicts, 1) is not null then
    return jsonb_build_object('ok', false, 'conflict', to_jsonb(conflicts));
  end if;

  for change in select * from jsonb_array_elements(p_changes)
  loop
    case change ->> 'op'
      when 'insert' then
        insert into public.studentos_rows (tbl, id, user_id, data)
        values (
          change ->> 'tbl',
          change ->> 'id',
          nullif(change ->> 'user_id', ''),
          change -> 'data'
        )
        /* An insert onto an existing key is a replay, not a failure: the
           application retried after a conflict and this row already landed. */
        on conflict (tbl, id) do update
          set data = excluded.data,
              user_id = excluded.user_id,
              updated_at = now();

      when 'update' then
        update public.studentos_rows
        set data = change -> 'data',
            user_id = nullif(change ->> 'user_id', ''),
            updated_at = now()
        where tbl = change ->> 'tbl'
          and id = change ->> 'id';

      when 'delete' then
        delete from public.studentos_rows
        where tbl = change ->> 'tbl'
          and id = change ->> 'id';

      else
        raise exception 'studentos_apply: unknown op %', change ->> 'op';
    end case;

    touched := touched || (change ->> 'tbl');
  end loop;

  /* Bump only the tables a change actually landed in. The caller also declares
     tables it merely read, so that a decision made from stale rows is caught by
     the check above — but bumping those would tell every other instance to
     reload something that did not move. */
  for expect_tbl in
    select distinct unnest(touched)
  loop
    insert into public.studentos_meta (tbl, revision, row_count, updated_at)
    values (
      expect_tbl,
      1,
      (select count(*) from public.studentos_rows where tbl = expect_tbl),
      now()
    )
    on conflict (tbl) do update
      set revision = public.studentos_meta.revision + 1,
          row_count = (select count(*) from public.studentos_rows where tbl = excluded.tbl),
          updated_at = now();
  end loop;

  return jsonb_build_object('ok', true, 'revisions', public.studentos_revisions());
end;
$$;

/* --------------------------------------------------------------------------
   First write: seeding
   ----------------------------------------------------------------------------
   Runs once, when `studentos_store_state` is empty. The advisory lock is what
   stops two cold instances that started in the same second from both deciding
   the store is empty and both seeding it.
   -------------------------------------------------------------------------- */

create or replace function public.studentos_seed(
  p_data           jsonb,
  p_schema_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tbl_name text;
  seeded   boolean;
begin
  perform pg_advisory_xact_lock(hashtext('studentos_seed'));

  select exists (select 1 from public.studentos_store_state) into seeded;
  if seeded then
    /* Another instance won the race. Its data is as good as ours and it is
       already visible; say so rather than overwriting it. */
    return jsonb_build_object('ok', true, 'seeded', false);
  end if;

  for tbl_name in select key from jsonb_each(p_data)
  loop
    insert into public.studentos_rows (tbl, id, user_id, data)
    select
      tbl_name,
      row_in ->> 'k',
      nullif(row_in #>> '{v,userId}', ''),
      row_in -> 'v'
    from jsonb_array_elements(p_data -> tbl_name) as row_in
    on conflict (tbl, id) do nothing;

    insert into public.studentos_meta (tbl, revision, row_count, updated_at)
    values (
      tbl_name,
      1,
      (select count(*) from public.studentos_rows where tbl = tbl_name),
      now()
    )
    on conflict (tbl) do update
      set revision = public.studentos_meta.revision + 1,
          row_count = excluded.row_count,
          updated_at = now();
  end loop;

  insert into public.studentos_store_state (id, schema_version)
  values (true, p_schema_version)
  on conflict (id) do update set schema_version = excluded.schema_version;

  return jsonb_build_object('ok', true, 'seeded', true);
end;
$$;

/* The schema version the store was last written at, or null when the store has
   never been seeded. Drives the same migration hook the JSON store uses. */
create or replace function public.studentos_state()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select jsonb_build_object(
       'schemaVersion', s.schema_version,
       'seededAt', s.seeded_at
     ) from public.studentos_store_state s limit 1),
    'null'::jsonb
  );
$$;

create or replace function public.studentos_set_schema_version(p_version integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.studentos_store_state set schema_version = p_version;
$$;

/* --------------------------------------------------------------------------
   Grants
   ----------------------------------------------------------------------------
   These are `security definer`, so a grant here would let that role run them
   with the definer's rights. Nothing is granted to `anon` or `authenticated`:
   the store is reachable only by the service role.
   -------------------------------------------------------------------------- */

revoke all on function public.studentos_dump(text[])          from public, anon, authenticated;
revoke all on function public.studentos_revisions()           from public, anon, authenticated;
revoke all on function public.studentos_apply(jsonb, jsonb)   from public, anon, authenticated;
revoke all on function public.studentos_seed(jsonb, integer)  from public, anon, authenticated;
revoke all on function public.studentos_state()               from public, anon, authenticated;
revoke all on function public.studentos_set_schema_version(integer) from public, anon, authenticated;

grant execute on function public.studentos_dump(text[])          to service_role;
grant execute on function public.studentos_revisions()           to service_role;
grant execute on function public.studentos_apply(jsonb, jsonb)   to service_role;
grant execute on function public.studentos_seed(jsonb, integer)  to service_role;
grant execute on function public.studentos_state()               to service_role;
grant execute on function public.studentos_set_schema_version(integer) to service_role;
