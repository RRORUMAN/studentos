-- ============================================================================
-- 0003 — operations: ingestion, source verification, reports, push
-- ----------------------------------------------------------------------------
-- Everything here is written by the service role from jobs and admin actions,
-- except confirmations and reports, which students write about their own city.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Event sources: where ingested events come from. One row per feed.
-- ---------------------------------------------------------------------------
create table event_sources (
  id            uuid primary key default gen_random_uuid(),
  city_slug     text not null,
  campus_slug   text,
  kind          text not null check (kind in ('ical', 'madrid-agenda')),
  url           text not null,
  label         text not null,
  default_kind  text not null,
  tags          text[] not null default '{}',
  trust         text not null check (trust in ('official', 'venue')),
  enabled       boolean not null default true,
  created_at    timestamptz not null default now(),
  last_sync_at  timestamptz,
  last_status   text not null default 'never' check (last_status in ('never', 'ok', 'error')),
  last_message  text,
  last_count    integer not null default 0
);
create index event_sources_city_idx on event_sources (city_slug, enabled);
alter table event_sources enable row level security;
-- Readable by everyone signed in (the UI prints the source next to an event);
-- written only by the service role.
create policy event_sources_read on event_sources for select using (auth.role() = 'authenticated');

alter table events add column if not exists source_id uuid references event_sources (id) on delete set null;
alter table events add column if not exists external_id text;
create unique index if not exists events_source_external_idx on events (source_id, external_id) where source_id is not null;

-- ---------------------------------------------------------------------------
-- Source checks: the last known state of every official page we cite.
-- ---------------------------------------------------------------------------
create table source_checks (
  url           text primary key,
  status        text not null check (status in ('ok', 'changed', 'unreachable')),
  http_status   integer,
  content_hash  text,
  checked_at    timestamptz not null default now(),
  changed_at    timestamptz,
  reviewed_at   timestamptz
);
alter table source_checks enable row level security;
create policy source_checks_read on source_checks for select using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- Content reports: "wrong info", from students or from the verification job.
-- ---------------------------------------------------------------------------
create table content_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users (id) on delete set null,
  target_kind  text not null check (target_kind in ('place', 'event', 'deal', 'official-fact', 'guide', 'source')),
  target_id    text not null,
  reason       text not null,
  note         text,
  status       text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolution   text
);
create index content_reports_open_idx on content_reports (status, created_at desc);
create index content_reports_target_idx on content_reports (target_kind, target_id);
alter table content_reports enable row level security;
create policy content_reports_insert on content_reports for insert with check (auth.uid() = user_id);
create policy content_reports_own on content_reports for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Confirmations: one student, one target, once. Drives "confirmed by N".
-- ---------------------------------------------------------------------------
create table confirmations (
  user_id      uuid not null references auth.users (id) on delete cascade,
  target_kind  text not null check (target_kind in ('place', 'event')),
  target_id    text not null,
  created_at   timestamptz not null default now(),
  primary key (user_id, target_kind, target_id)
);
alter table confirmations enable row level security;
create policy confirmations_own on confirmations for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Counts are read through a security-definer view so no student can list who confirmed.
create view confirmation_counts as
  select target_kind, target_id, count(*)::integer as confirmations
  from confirmations group by target_kind, target_id;

-- ---------------------------------------------------------------------------
-- Push subscriptions: one row per device. Endpoint is the secret; never listed.
-- ---------------------------------------------------------------------------
create table push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  failures     integer not null default 0
);
create index push_subscriptions_user_idx on push_subscriptions (user_id);
alter table push_subscriptions enable row level security;
create policy push_subscriptions_own on push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table notification_prefs add column if not exists digest_sent_at timestamptz;
