-- ===========================================================================
-- 0006 — SCHEDULED CLEANUP
-- ---------------------------------------------------------------------------
-- Four kinds of row in the store have a natural end and nothing was ever
-- deleting them: expired sessions, spent or expired auth tokens, the Stripe
-- idempotency ledger, and the AI usage log. Left alone they grow without limit,
-- and two of them are worse than merely large. An expired session row is a
-- hashed credential that no longer serves any purpose, and a spent
-- reset-password token is the same. Rows that can only cause harm should not be
-- kept.
--
-- Why this runs in the database rather than as a Vercel Cron route: it touches
-- nothing but rows. It needs no application code, and running it here means it
-- keeps happening when there is no deployment, when the project is between
-- deploys, and when every function is cold. The rule this project follows is in
-- DECISIONS.md: schedule by what the job touches, not by what is convenient.
--
-- THE THING TO GET RIGHT, if you edit this file: a delete has to bump
-- `studentos_meta.revision` for every logical table it touched. Running
-- instances poll that table to decide what to reload, so a delete that does not
-- bump it leaves them serving rows that no longer exist for up to FRESHNESS_MS,
-- and a signed-out session would keep working. `studentos_prune()` does the
-- bump at the end, once, for the tables that actually lost rows.
--
-- Applies on top of 0005. Nothing here touches migrations 0001 to 0004, which
-- describe a relational target that no code reads and that must not be applied.
-- ===========================================================================

create extension if not exists pg_cron;

/* --------------------------------------------------------------------------
   Retention
   ----------------------------------------------------------------------------
   Stated as one table so the policy is readable in one place rather than
   scattered through the delete statements.

   sessions               gone the moment they expire. Nothing reads an expired
                          session, and the row is a hashed credential.
   authTokens             expired, or consumed more than 7 days ago. The grace
                          period is so that "this link has already been used"
                          can still be told apart from "we have never heard of
                          this link" for a week, which is the difference between
                          a helpful message and a confusing one.
   processedStripeEvents  90 days. This is the ledger that stops a webhook being
                          applied twice. Stripe retries a failed event for at
                          most 3 days, so 90 is thirty times the window that
                          matters and still bounded.
   aiUsage                400 days. /admin reports over 28-day windows, so this
                          keeps more than a year of history for year-on-year
                          comparison while stopping the table growing forever.
                          Deleting these loses spend history: widen it here
                          rather than in a query if that history is wanted.
   -------------------------------------------------------------------------- */

create or replace function public.studentos_prune()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts       timestamptz := now();
  touched      text[] := '{}';
  removed      jsonb := '{}'::jsonb;
  affected     integer;
  tbl_name     text;
begin
  /* ---- expired sessions ------------------------------------------------ */
  delete from public.studentos_rows
  where tbl = 'sessions'
    and (data ->> 'expiresAt')::timestamptz < now_ts;

  get diagnostics affected = row_count;
  if affected > 0 then
    touched := touched || 'sessions';
  end if;
  removed := removed || jsonb_build_object('sessions', affected);

  /* ---- spent and expired auth tokens ----------------------------------- */
  delete from public.studentos_rows
  where tbl = 'authTokens'
    and (
      (data ->> 'expiresAt')::timestamptz < now_ts
      or (
        data ->> 'consumedAt' is not null
        and (data ->> 'consumedAt')::timestamptz < now_ts - interval '7 days'
      )
    );

  get diagnostics affected = row_count;
  if affected > 0 then
    touched := touched || 'authTokens';
  end if;
  removed := removed || jsonb_build_object('authTokens', affected);

  /* ---- the Stripe idempotency ledger ----------------------------------- */
  delete from public.studentos_rows
  where tbl = 'processedStripeEvents'
    and (data ->> 'at')::timestamptz < now_ts - interval '90 days';

  get diagnostics affected = row_count;
  if affected > 0 then
    touched := touched || 'processedStripeEvents';
  end if;
  removed := removed || jsonb_build_object('processedStripeEvents', affected);

  /* ---- the AI usage log ------------------------------------------------ */
  delete from public.studentos_rows
  where tbl = 'aiUsage'
    and (data ->> 'createdAt')::timestamptz < now_ts - interval '400 days';

  get diagnostics affected = row_count;
  if affected > 0 then
    touched := touched || 'aiUsage';
  end if;
  removed := removed || jsonb_build_object('aiUsage', affected);

  /* ---- tell every running instance what moved -------------------------- */
  foreach tbl_name in array touched
  loop
    insert into public.studentos_meta (tbl, revision, row_count, updated_at)
    values (
      tbl_name,
      1,
      (select count(*) from public.studentos_rows where tbl = tbl_name),
      now()
    )
    on conflict (tbl) do update
      set revision = public.studentos_meta.revision + 1,
          row_count = (select count(*) from public.studentos_rows where tbl = excluded.tbl),
          updated_at = now();
  end loop;

  return jsonb_build_object('ok', true, 'at', now_ts, 'removed', removed);
end;
$$;

/* Same posture as every other function here: the service role and the cron
   runner, nobody else. `anon` and `authenticated` must not be able to make the
   database do work on request. */
revoke all on function public.studentos_prune() from public, anon, authenticated;
grant execute on function public.studentos_prune() to service_role;

/* --------------------------------------------------------------------------
   The schedule
   ----------------------------------------------------------------------------
   03:11 UTC daily. Off the hour and off the half hour because that is where
   every other scheduled job in the world sits, and daily because none of these
   retention windows is measured in hours.

   Unscheduled first so that re-running this migration replaces the job rather
   than creating a second one beside it, which is what makes the file safe to
   apply twice.
   -------------------------------------------------------------------------- */

do $$
begin
  perform cron.unschedule('studentos-prune');
exception
  when others then
    /* No such job. Which is the normal state on a first apply. */
    null;
end;
$$;

select cron.schedule('studentos-prune', '11 3 * * *', $$select public.studentos_prune()$$);
