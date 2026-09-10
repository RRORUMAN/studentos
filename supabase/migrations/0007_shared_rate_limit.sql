-- ===========================================================================
-- 0007 — SHARED RATE LIMIT
-- ---------------------------------------------------------------------------
-- `src/server/rate-limit.ts` is a fixed-window counter in process memory, and
-- it has always said so: "behind two instances a caller gets two windows. The
-- production deployment puts a Redis or edge limiter in front for that."
--
-- That front never arrived, and the deployment is serverless. There is no
-- steady "two instances" — Vercel starts a fresh isolate whenever it needs one,
-- and a cold start begins with an empty Map. So `authAttempt: 8 per 15 minutes`
-- is eight attempts per isolate, and the number of isolates is chosen by the
-- traffic the attacker themselves is generating. The limit that guards password
-- guessing was, in production, approximately no limit at all.
--
-- WHY THIS IS A TABLE AND NOT REDIS. It needs to be atomic, shared, and already
-- deployed. Postgres is two of those and can do the third in one statement:
-- `insert … on conflict do update … returning` increments and reports the new
-- value in a single round trip under row lock, which is exactly the primitive a
-- fixed-window limiter needs. Adding Redis would add a service to configure, a
-- second thing that can be down, and a second place secrets live, to do one
-- upsert per sign-in attempt.
--
-- WHY IT IS NOT IN `studentos_rows`. The row store is a cache-and-diff design:
-- instances hold a copy, poll `studentos_meta.revision`, and reload what moved.
-- Rate counters are the opposite shape — write-mostly, read-never, correct only
-- when read at the instant of use, and worthless a minute later. Putting them in
-- the row store would bump a revision on every login attempt and make every
-- instance reload a table nobody reads. Its own table, its own function, no
-- revision, no cache.
--
-- HOW IT FAILS. The application treats an unreachable or absent
-- `studentos_rate_hit` as "not available" and falls back to the in-process
-- limiter, which is what it had before this file existed. It does not fail a
-- sign-in because the limiter is down; it does not silently pretend to be
-- limiting either — `/admin` → Services reports which of the two is live.
--
-- Applies on top of 0005 and is independent of 0006. Nothing here touches
-- migrations 0001 to 0004, which describe a relational target that no code
-- reads and that must not be applied. Safe to apply twice.
-- ===========================================================================

/* 0006 creates this too. Repeated here so the two files stay independent of
   each other's ordering, which `if not exists` makes free. */
create extension if not exists pg_cron;

create table if not exists public.studentos_rate_limits (
  key       text primary key,
  count     integer     not null,
  reset_at  timestamptz not null
);

/* Nothing but the service role reads anything, which is the same posture as
   `studentos_rows`: authorisation lives in the application, and RLS on with no
   policies is what makes "nobody" the default rather than "everybody". */
alter table public.studentos_rate_limits enable row level security;

/* Every lookup is by primary key. The one range scan is the prune below, and
   it runs hourly against a table that is small by construction. */
create index if not exists studentos_rate_limits_reset_idx
  on public.studentos_rate_limits (reset_at);

/* --------------------------------------------------------------------------
   Consume one unit
   ----------------------------------------------------------------------------
   Returns the same shape as the in-process limiter so the two are
   interchangeable at the call site: { ok, remaining, retryAfterSeconds }.

   FIXED WINDOW, deliberately, matching the in-process one. A sliding window
   needs per-request timestamps and buys nothing against online password
   guessing: the burst allowed at a window boundary is bounded by the limit,
   and the limit is already sized for it.

   The expiry check lives inside the UPDATE rather than in a preceding DELETE.
   A delete-then-insert is two statements and a race between them; this is one
   statement holding one row lock, so a thousand simultaneous attempts on one
   key are serialised by Postgres and counted exactly once each.
   -------------------------------------------------------------------------- */

create or replace function public.studentos_rate_hit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts    timestamptz := now();
  new_count integer;
  ends_at   timestamptz;
begin
  if p_key is null or p_limit is null or p_limit < 1 or p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'studentos_rate_hit: key, a limit of at least 1 and a window of at least 1 second are required';
  end if;

  insert into public.studentos_rate_limits as r (key, count, reset_at)
  values (p_key, 1, now_ts + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set count = case when r.reset_at <= now_ts then 1 else r.count + 1 end,
        reset_at = case
                     when r.reset_at <= now_ts then now_ts + make_interval(secs => p_window_seconds)
                     else r.reset_at
                   end
  returning r.count, r.reset_at into new_count, ends_at;

  return jsonb_build_object(
    'ok', new_count <= p_limit,
    'remaining', greatest(0, p_limit - new_count),
    'retryAfterSeconds', greatest(1, ceil(extract(epoch from (ends_at - now_ts)))::integer)
  );
end;
$$;

/* --------------------------------------------------------------------------
   Forgive a key
   ----------------------------------------------------------------------------
   Called after a successful sign-in. Somebody who mistyped their password three
   times and then got it right is not mid-attack, and leaving the count against
   them means their next genuine mistake locks them out of their own budget.
   -------------------------------------------------------------------------- */

create or replace function public.studentos_rate_reset(p_key text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.studentos_rate_limits where key = p_key;
$$;

/* --------------------------------------------------------------------------
   Prune
   ----------------------------------------------------------------------------
   A window that has ended is a row that can only take up space: the hit
   function treats an expired row as absent, so deleting one changes no answer.
   Hourly, because the longest window in `limits` is an hour and this table
   should stay roughly the size of one hour of traffic.
   -------------------------------------------------------------------------- */

create or replace function public.studentos_rate_prune()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.studentos_rate_limits where reset_at <= now();
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.studentos_rate_hit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.studentos_rate_reset(text) from public, anon, authenticated;
revoke all on function public.studentos_rate_prune() from public, anon, authenticated;

grant execute on function public.studentos_rate_hit(text, integer, integer) to service_role;
grant execute on function public.studentos_rate_reset(text) to service_role;
grant execute on function public.studentos_rate_prune() to service_role;

/* Unscheduled first so re-applying this file replaces the job rather than
   creating a second one beside it. */
do $$
begin
  perform cron.unschedule('studentos-rate-prune');
exception
  when others then
    /* No such job, which is the normal state on a first apply. */
    null;
end;
$$;

select cron.schedule('studentos-rate-prune', '7 * * * *', $$select public.studentos_rate_prune()$$);
