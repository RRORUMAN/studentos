-- ============================================================================
-- 0002 — the daily product
-- ----------------------------------------------------------------------------
-- Event responses, plan membership and votes, chat preferences and reactions,
-- notification delivery modes. Same conventions as 0001: integer minor units,
-- timestamptz, RLS on every table that carries a user id.
-- ============================================================================

create table event_responses (
  event_id     uuid not null references events (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  status       text not null check (status in ('interested', 'going')),
  responded_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_responses_user_idx on event_responses (user_id);

create table plan_members (
  plan_id    uuid not null references saved_plans (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  status     text not null check (status in ('invited', 'in', 'out')),
  updated_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);

create table plan_votes (
  plan_id    uuid not null references saved_plans (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  item_index integer not null check (item_index >= 0),
  value      smallint not null check (value in (1, -1)),
  created_at timestamptz not null default now(),
  primary key (plan_id, user_id, item_index)
);

alter table chat_messages add column attachment jsonb;

create table chat_reactions (
  message_id uuid not null references chat_messages (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  emoji      text not null check (char_length(emoji) <= 8),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create table chat_prefs (
  user_id      uuid not null references auth.users (id) on delete cascade,
  channel      text not null,
  pinned       boolean not null default false,
  muted        boolean not null default false,
  archived     boolean not null default false,
  last_read_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (user_id, channel)
);

alter table notification_prefs add column delivery jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table event_responses enable row level security;
alter table plan_members    enable row level security;
alter table plan_votes      enable row level security;
alter table chat_reactions  enable row level security;
alter table chat_prefs      enable row level security;

-- Responses are visible to the city (they power "42 students interested"),
-- writable only by their owner.
create policy event_responses_read on event_responses for select using (true);
create policy event_responses_own  on event_responses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Plan membership is visible to the plan's owner and its members.
create policy plan_members_read on plan_members for select using (
  auth.uid() = user_id
  or exists (select 1 from saved_plans p where p.id = plan_id and (p.user_id = auth.uid() or p.shared))
);
create policy plan_members_own on plan_members for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy plan_members_owner_invites on plan_members for insert with check (
  exists (select 1 from saved_plans p where p.id = plan_id and p.user_id = auth.uid())
);

create policy plan_votes_read on plan_votes for select using (
  exists (select 1 from saved_plans p where p.id = plan_id and (p.user_id = auth.uid() or p.shared))
  or exists (select 1 from plan_members m where m.plan_id = plan_id and m.user_id = auth.uid())
);
create policy plan_votes_own on plan_votes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy chat_reactions_read on chat_reactions for select using (true);
create policy chat_reactions_own  on chat_reactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy chat_prefs_owner on chat_prefs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Monetisation and operations
-- ---------------------------------------------------------------------------

create table upgrade_triggers (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  trigger      text not null,
  feature      text not null,
  plan_at_time text not null,
  shown_at     timestamptz not null default now()
);
create index upgrade_triggers_user_idx on upgrade_triggers (user_id, shown_at desc);
create index upgrade_triggers_trigger_idx on upgrade_triggers (trigger, shown_at desc);

alter table upgrade_triggers enable row level security;
create policy upgrade_triggers_own on upgrade_triggers for select using (auth.uid() = user_id);
create policy upgrade_triggers_insert on upgrade_triggers for insert with check (auth.uid() = user_id);

-- Admin-editable settings. No user policy: read and written through the
-- service role by the admin surface only.
create table admin_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
alter table admin_settings enable row level security;
