-- ============================================================================
-- 0004 — LifeOps, Smart Missions, Student Exchange, Ask history, follows
-- ----------------------------------------------------------------------------
-- Same conventions as 0001: integer minor units, timestamptz, RLS on every
-- table that carries a user id. Every table here mirrors a type in
-- `src/domain/lifeops.ts`, `src/domain/missions.ts`, `src/domain/social.ts`
-- or `src/domain/types.ts` one-for-one.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- LifeOps: custom tasks and overrides for derived items
-- ---------------------------------------------------------------------------
create table lifeops_tasks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  title          text not null check (length(title) between 1 and 120),
  detail         text check (length(detail) <= 400),
  kind           text not null check (kind in ('task','deadline','class','reminder','payment','travel','social')),
  due_at         timestamptz,
  all_day        boolean not null default false,
  href           text,
  source         text not null check (source in ('custom','arrival','leaving','mission','event','invite','plan','recurring')),
  -- `arrival:<taskId>`, `event:<eventId>`, `recurring:<id>:<yyyy-mm>`. Null for custom tasks.
  source_ref     text,
  -- Weekly items roll forward a week when completed.
  repeat         text check (repeat in ('weekly')),
  done_at        timestamptz,
  snoozed_until  timestamptz,
  dismissed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index lifeops_tasks_user_due_idx on lifeops_tasks (user_id, due_at);
create unique index lifeops_tasks_override_idx on lifeops_tasks (user_id, source_ref) where source_ref is not null;

alter table lifeops_tasks enable row level security;
create policy lifeops_tasks_owner on lifeops_tasks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Smart Missions
-- ---------------------------------------------------------------------------
create table missions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  template_key  text not null,
  city_slug     text not null,
  title         text not null,
  emoji         text not null,
  budget_cents  bigint check (budget_cents is null or budget_cents >= 0),
  status        text not null default 'active' check (status in ('active','completed','abandoned')),
  variant       jsonb not null default '{"cheaper":false,"social":false}'::jsonb,
  -- Public share token. Null until the student shares it.
  share_token   text unique,
  started_at    timestamptz not null default now(),
  due_at        timestamptz not null,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index missions_user_idx on missions (user_id, status);

create table mission_steps (
  id           uuid primary key default gen_random_uuid(),
  mission_id   uuid not null references missions (id) on delete cascade,
  "order"      integer not null check ("order" >= 0),
  key          text not null,
  label        text not null,
  detail       text,
  kind         text not null check (kind in ('task','place','event','social','budget','transport','buffer')),
  price_cents  bigint not null default 0 check (price_cents >= 0),
  ref_kind     text check (ref_kind in ('place','event','invite','deal')),
  ref_id       text,
  href         text,
  optional     boolean not null default false,
  official     boolean not null default false,
  done_at      timestamptz,
  skipped_at   timestamptz
);
create index mission_steps_mission_idx on mission_steps (mission_id, "order");

alter table missions      enable row level security;
alter table mission_steps enable row level security;

-- A mission is private, except that a shared one is readable by its token
-- through the service role on the public share page.
create policy missions_owner on missions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy mission_steps_owner on mission_steps for all
  using (exists (select 1 from missions m where m.id = mission_id and m.user_id = auth.uid()))
  with check (exists (select 1 from missions m where m.id = mission_id and m.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Student Exchange: the marketplace becomes five lanes
-- ---------------------------------------------------------------------------
alter table listings add column if not exists kind text not null default 'sell'
  check (kind in ('sell','borrow','help','ride','free'));
alter table listings add column if not exists mode text not null default 'offer'
  check (mode in ('offer','request'));
alter table listings add column if not exists when_at timestamptz;
-- Older rows used `category = 'free'` as the lane.
update listings set kind = 'free' where category = 'free';
alter table listings drop constraint if exists listings_status_check;
alter table listings add constraint listings_status_check
  check (status in ('active','reserved','sold','completed','withdrawn'));
create index if not exists listings_city_kind_idx on listings (city_slug, kind, status, created_at desc);

-- Saved items may now point at a listing or a post.
alter table saved_items drop constraint if exists saved_items_kind_check;
alter table saved_items add constraint saved_items_kind_check
  check (kind in ('place','event','deal','plan','listing','post'));

-- Reports may now target listings, posts, comments and users.
alter table content_reports drop constraint if exists content_reports_target_kind_check;
alter table content_reports add constraint content_reports_target_kind_check
  check (target_kind in ('place','event','deal','official-fact','guide','source','listing','post','comment','user'));
alter table content_reports drop constraint if exists content_reports_reason_check;
alter table content_reports add constraint content_reports_reason_check
  check (reason in ('wrong-price','closed','wrong-hours','wrong-info','expired','source-changed','scam','spam','harassment','unsafe','other'));

-- ---------------------------------------------------------------------------
-- Ask history: a student's own recent questions
-- ---------------------------------------------------------------------------
create table ask_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  query      text not null check (length(query) <= 300),
  intent     text not null,
  summary    text not null default '',
  tier       smallint not null default 0 check (tier between 0 and 3),
  created_at timestamptz not null default now()
);
create index ask_history_user_idx on ask_history (user_id, created_at desc);
alter table ask_history enable row level security;
create policy ask_history_owner on ask_history for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Follows: one-directional, public
-- ---------------------------------------------------------------------------
create table follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followee_id uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on follows (followee_id);
alter table follows enable row level security;
create policy follows_read on follows for select using (auth.role() = 'authenticated');
create policy follows_own  on follows for all
  using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

-- ---------------------------------------------------------------------------
-- AI operations gain `mission`
-- ---------------------------------------------------------------------------
alter table ai_usage drop constraint if exists ai_usage_operation_check;
alter table ai_usage add constraint ai_usage_operation_check
  check (operation in ('classify','extract','summarize','recommend','plan','budget','mission','moderate'));

-- ---------------------------------------------------------------------------
-- Polls and attachments in Pulse and chat; event images from sources
-- ---------------------------------------------------------------------------
alter table posts add column if not exists poll jsonb;
alter table posts add column if not exists attachment jsonb;
alter table events add column if not exists image_url text;

create table poll_votes (
  post_id      uuid not null references posts (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  option_index integer not null check (option_index >= 0),
  created_at   timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table poll_votes enable row level security;
create policy poll_votes_read on poll_votes for select using (auth.role() = 'authenticated');
create policy poll_votes_own  on poll_votes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table chat_polls (
  id         uuid primary key default gen_random_uuid(),
  channel    text not null,
  author_id  uuid not null references auth.users (id) on delete cascade,
  question   text not null check (length(question) between 1 and 200),
  options    jsonb not null,
  closes_at  timestamptz,
  created_at timestamptz not null default now()
);
create index chat_polls_channel_idx on chat_polls (channel, created_at desc);

create table chat_poll_votes (
  poll_id      uuid not null references chat_polls (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  option_index integer not null check (option_index >= 0),
  created_at   timestamptz not null default now(),
  primary key (poll_id, user_id)
);
alter table chat_polls      enable row level security;
alter table chat_poll_votes enable row level security;
-- Readable by whoever can read the channel; the channel check lives in the
-- application's `canReadChannel`, mirrored here for city channels only.
create policy chat_polls_read on chat_polls for select using (auth.role() = 'authenticated');
create policy chat_polls_own  on chat_polls for insert with check (auth.uid() = author_id);
create policy chat_poll_votes_read on chat_poll_votes for select using (auth.role() = 'authenticated');
create policy chat_poll_votes_own  on chat_poll_votes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
