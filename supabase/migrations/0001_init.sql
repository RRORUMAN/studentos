-- ============================================================================
-- StudentOS — initial schema
-- ----------------------------------------------------------------------------
-- The production shape of everything `src/domain/*.ts` describes, with the
-- constraints and Row Level Security policies the local JSON store cannot
-- express. Running this against a fresh Supabase project is what turns the
-- development fallback into the real backend.
--
-- Three rules are enforced here rather than in application code, because
-- application code can be bypassed and a CHECK cannot:
--
--   1. Money is `bigint` minor units. There is no `numeric`, no `float`, and
--      no column anywhere that can hold €18.399999.
--   2. An official fact cannot exist without a source URL and a checked date.
--      Immigration guidance with no provenance is not publishable, so it is
--      not storable.
--   3. A marketplace listing has no address column. A seller cannot publish
--      where they live because there is nowhere to put it.
--
-- The single most important policy in the file is
-- `profiles_select_public_columns`: the precise home coordinate is readable
-- only by its owner, under every other policy, always.
-- ============================================================================

create extension if not exists "postgis";
create extension if not exists "vector";
create extension if not exists "pgcrypto";

-- ============================================================================
-- ACCOUNT
-- ============================================================================

-- Supabase owns `auth.users`. Everything below keys off it.

create type student_status as enum (
  'studying-abroad', 'international', 'exchange', 'home-country', 'moving-soon', 'other'
);

create type price_sensitivity as enum ('cheapest', 'value', 'balanced', 'occasional-splurge');

create type profile_visibility as enum ('public', 'campus', 'friends', 'private');

create table profiles (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  handle            text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name      text not null check (length(display_name) between 1 and 40),
  avatar_emoji      text not null default '🙂',
  bio               text check (length(bio) <= 200),

  student_status    student_status not null default 'other',

  city_slug         text not null,
  country_code      char(2) not null,
  arriving_on       timestamptz,
  leaving_on        timestamptz,

  campus_slug       text,
  university_name   text,

  -- The coarse label, safe to show. Free text because neighbourhood naming is
  -- not consistent across the world.
  home_area         text,
  -- The precise point. See `profiles_home_point_owner_only` below: this column
  -- is never readable by another user under any policy in this schema.
  home_point        geography(Point, 4326),

  money_goals       text[] not null default '{}',
  interests         text[] not null default '{}',
  social_goals      text[] not null default '{}',
  diets             text[] not null default '{}',
  transport         text[] not null default '{walk}',
  max_travel_minutes int not null default 30 check (max_travel_minutes between 5 and 180),
  price_sensitivity price_sensitivity not null default 'value',

  currency          char(3) not null default 'EUR',
  locale            text not null default 'en-IE',

  student_verified_at timestamptz,
  terms_in_city     int not null default 1 check (terms_in_city >= 0),

  visibility        profile_visibility not null default 'campus',
  show_city         boolean not null default true,
  show_campus       boolean not null default true,
  show_interests    boolean not null default true,
  discoverable      boolean not null default true,

  onboarded_at      timestamptz,
  created_at        timestamptz not null default now()
);

create index profiles_city_idx on profiles (city_slug);
create index profiles_campus_idx on profiles (campus_slug) where campus_slug is not null;
-- Spatial index so "within N minutes of home" is index-backed rather than a
-- full scan. Only ever queried with the owner's own point.
create index profiles_home_point_idx on profiles using gist (home_point);

-- ---------------------------------------------------------------------------
-- The move. Drives the lifecycle stage, and therefore what Home leads with.
-- ---------------------------------------------------------------------------
create type housing_situation as enum (
  'sorted', 'temporary', 'searching', 'university-halls', 'with-family', 'unknown'
);

create table moves (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  from_country_code char(2),
  to_country_code   char(2) not null,
  city_slug         text not null,
  campus_slug       text,
  arriving_on       timestamptz,
  leaving_on        timestamptz,
  housing           housing_situation not null default 'unknown',
  stay_months       int check (stay_months between 1 and 72),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- A departure before an arrival is always a data-entry error.
  constraint move_dates_ordered check (
    arriving_on is null or leaving_on is null or leaving_on > arriving_on
  )
);

-- ============================================================================
-- BILLING
-- ============================================================================

create type plan_key as enum ('free', 'starter', 'plus', 'max');

create type subscription_status as enum (
  'active', 'trialing', 'past_due', 'canceled', 'incomplete', 'none'
);

create table subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  plan                   plan_key not null default 'free',
  status                 subscription_status not null default 'none',
  period                 text not null default 'monthly' check (period in ('monthly','annual')),
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  updated_at             timestamptz not null default now()
);

-- Webhook idempotency. Stripe retries; processing an event twice must be
-- indistinguishable from processing it once.
create table processed_stripe_events (
  id           text primary key,
  processed_at timestamptz not null default now()
);

-- ============================================================================
-- MONEY
-- ============================================================================

create table budget_setups (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  mode                text not null default 'simple' check (mode in ('simple','detailed')),
  monthly_total_cents bigint not null default 0 check (monthly_total_cents >= 0),
  exclude_housing     boolean not null default false,
  updated_at          timestamptz not null default now()
);

create table budget_envelopes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  -- 'YYYY-MM'. Month granularity everywhere; budgets are monthly objects.
  month          char(7) not null check (month ~ '^\d{4}-\d{2}$'),
  category       text not null,
  planned_cents  bigint not null default 0 check (planned_cents >= 0),
  custom         boolean not null default false,

  unique (user_id, month, category)
);

create index budget_envelopes_user_month_idx on budget_envelopes (user_id, month);

create type transaction_source as enum ('manual', 'receipt', 'recurring', 'import');

create table transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  category     text not null,
  amount_cents bigint not null check (amount_cents > 0),
  merchant     text,
  note         text check (length(note) <= 200),
  -- Date of spend, not of entry. The two differ constantly.
  spent_at     timestamptz not null default now(),
  source       transaction_source not null default 'manual',
  receipt_id   uuid,
  created_at   timestamptz not null default now()
);

create index transactions_user_spent_idx on transactions (user_id, spent_at desc);

create table recurring_expenses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  label         text not null,
  category      text not null,
  amount_cents  bigint not null check (amount_cents > 0),
  cadence       text not null check (cadence in ('weekly','monthly','termly')),
  day_of_period int not null check (day_of_period between 0 and 31),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ============================================================================
-- PLACES, EVENTS, DEALS
-- ============================================================================

create table places (
  id                  uuid primary key default gen_random_uuid(),
  city_slug           text not null,
  name                text not null,
  category            text not null,
  layers              text[] not null default '{}',
  typical_price_cents bigint check (typical_price_cents >= 0),
  location            geography(Point, 4326) not null,
  -- Independent student confirmations. The verified badge is derived from
  -- this, never set directly.
  verified_by         int not null default 0 check (verified_by >= 0),
  student_value       int not null default 50 check (student_value between 0 and 100),
  why                 text not null,
  source              text not null check (source in ('students','official','venue','mixed')),
  observed_at         timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create index places_city_idx on places (city_slug);
create index places_location_idx on places using gist (location);
create index places_layers_idx on places using gin (layers);

create table events (
  id            uuid primary key default gen_random_uuid(),
  city_slug     text not null,
  campus_slug   text,
  title         text not null,
  blurb         text not null,
  kind          text not null,
  -- Zero is a real and important answer, never null for "free".
  price_cents   bigint not null default 0 check (price_cents >= 0),
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  venue         text not null,
  point         geography(Point, 4326) not null,
  source        text not null check (source in ('students','official','venue')),
  source_url    text,
  confirmations int not null default 0 check (confirmations >= 0),
  interested    int not null default 0 check (interested >= 0),
  tags          text[] not null default '{}',
  observed_at   timestamptz not null default now(),

  constraint event_ends_after_start check (ends_at is null or ends_at > starts_at)
);

create index events_city_starts_idx on events (city_slug, starts_at);
create index events_point_idx on events using gist (point);
create index events_free_idx on events (city_slug, starts_at) where price_cents = 0;

create table deals (
  id                   uuid primary key default gen_random_uuid(),
  city_slug            text not null,
  place_id             uuid references places(id) on delete set null,
  title                text not null,
  detail               text not null,
  value                text not null,
  category             text not null,
  requires_student_id  boolean not null default false,
  expires_at           timestamptz,
  source               text not null check (source in ('students','official','venue')),
  submitted_by         uuid references auth.users(id) on delete set null,
  verified_at          timestamptz,
  created_at           timestamptz not null default now()
);

create index deals_city_idx on deals (city_slug);

-- The freshness layer, and the most defensible data the product holds: a
-- discount directory is copyable, one that knows what worked today is not.
create table deal_reports (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid not null references deals(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  outcome    text not null check (
               outcome in ('worked','did-not-work','expired','requirements-changed')
             ),
  note       text,
  created_at timestamptz not null default now(),

  -- One standing report per student per deal; a new one replaces the old.
  unique (deal_id, user_id)
);

create index deal_reports_deal_idx on deal_reports (deal_id, created_at desc);

-- ============================================================================
-- KNOWLEDGE
-- ============================================================================

create type official_topic as enum (
  'immigration','residency','visa','registration','healthcare','tax','legal',
  'university','transport','emergency'
);

-- Every row must carry provenance. A requirement with no source is not a
-- requirement, it is a guess, and the CHECK makes it unstorable.
create table official_facts (
  id                     uuid primary key default gen_random_uuid(),
  city_slug              text,
  country_code           char(2) not null,
  topic                  official_topic not null,
  title                  text not null,
  summary                text not null,
  source_name            text not null check (length(source_name) > 0),
  source_url             text not null check (source_url ~ '^https?://'),
  checked_at             timestamptz not null,
  authority              text not null check (authority in ('official','university','community')),
  -- When true the UI refuses to state a single answer and links the source.
  varies_by_nationality  boolean not null default false
);

create index official_facts_country_topic_idx on official_facts (country_code, topic);

create table guides (
  id            uuid primary key default gen_random_uuid(),
  city_slug     text,
  country_code  char(2),
  category      text not null,
  title         text not null,
  answer        text not null,
  points        text[] not null default '{}',
  source        text not null check (source in ('official','students','editorial')),
  source_url    text,
  checked_at    timestamptz not null default now(),
  confirmations int not null default 0 check (confirmations >= 0)
);

-- Observed student prices. Never scraped, never invented.
create table price_observations (
  id           uuid primary key default gen_random_uuid(),
  city_slug    text not null,
  place_id     uuid references places(id) on delete cascade,
  item         text not null,
  amount_cents bigint not null check (amount_cents >= 0),
  currency     char(3) not null,
  source       text not null check (source in ('student-report','receipt','official','venue')),
  user_id      uuid references auth.users(id) on delete set null,
  observed_at  timestamptz not null default now()
);

create index price_observations_city_item_idx on price_observations (city_slug, item, observed_at desc);

-- Retrievable statements with embeddings, for semantic retrieval before a
-- model is called. Retrieval is what makes an answer sourceable.
create table facts (
  id             uuid primary key default gen_random_uuid(),
  city_slug      text not null,
  place_id       uuid references places(id) on delete cascade,
  statement      text not null,
  source         text not null check (source in ('students','official','venue')),
  source_url     text,
  confirmations  int not null default 0,
  embedding      vector(1536),
  observed_at    timestamptz not null default now(),
  -- Facts expire. A price from two years ago is not a fact.
  expires_at     timestamptz
);

create index facts_city_idx on facts (city_slug);
create index facts_embedding_idx on facts using hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- COMMUNITY
-- ============================================================================

create table posts (
  id            uuid primary key default gen_random_uuid(),
  city_slug     text not null,
  campus_slug   text,
  channel       text not null,
  author_id     uuid references auth.users(id) on delete set null,
  kind          text not null,
  title         text not null check (length(title) between 4 and 160),
  body          text check (length(body) <= 2000),
  place_id      uuid references places(id) on delete set null,
  upvotes       int not null default 0 check (upvotes >= 0),
  comment_count int not null default 0 check (comment_count >= 0),
  -- Soft moderation: hidden rows stay for audit and are never selected.
  hidden_at     timestamptz,
  created_at    timestamptz not null default now()
);

create index posts_city_created_idx on posts (city_slug, created_at desc) where hidden_at is null;
create index posts_channel_idx on posts (city_slug, channel, created_at desc) where hidden_at is null;

create table comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  parent_id  uuid references comments(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  body       text not null check (length(body) between 1 and 2000),
  upvotes    int not null default 0,
  hidden_at  timestamptz,
  created_at timestamptz not null default now()
);

create index comments_post_idx on comments (post_id, created_at);

create table votes (
  user_id     uuid not null references auth.users(id) on delete cascade,
  target_kind text not null check (target_kind in ('post','comment')),
  target_id   uuid not null,
  value       smallint not null check (value in (-1, 1)),
  created_at  timestamptz not null default now(),

  primary key (user_id, target_kind, target_id)
);

create table chat_messages (
  id          uuid primary key default gen_random_uuid(),
  city_slug   text not null,
  channel     text not null,
  author_id   uuid references auth.users(id) on delete set null,
  body        text not null check (length(body) between 1 and 1000),
  reply_to_id uuid references chat_messages(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index chat_channel_idx on chat_messages (city_slug, channel, created_at desc);

-- ============================================================================
-- SOCIAL
-- ============================================================================

create table communities (
  id           uuid primary key default gen_random_uuid(),
  city_slug    text,
  campus_slug  text,
  kind         text not null,
  slug         text not null unique,
  name         text not null,
  blurb        text not null,
  emoji        text not null default '👥',
  member_count int not null default 0 check (member_count >= 0),
  created_at   timestamptz not null default now()
);

create table community_members (
  community_id uuid not null references communities(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member' check (role in ('member','moderator')),
  joined_at    timestamptz not null default now(),

  primary key (community_id, user_id)
);

create table invites (
  id            uuid primary key default gen_random_uuid(),
  city_slug     text not null,
  host_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  detail        text,
  anchor_kind   text check (anchor_kind in ('place','event','plan')),
  anchor_id     uuid,
  starts_at     timestamptz not null,
  audience      text not null default 'city' check (audience in ('friends','campus','city')),
  capacity      int not null check (capacity between 2 and 50),
  budget_cents  bigint check (budget_cents >= 0),
  -- Groups are temporary by design; they close after the thing happens.
  closes_at     timestamptz not null,
  created_at    timestamptz not null default now()
);

create index invites_city_open_idx on invites (city_slug, starts_at) where closes_at > now();

create table invite_responses (
  invite_id    uuid not null references invites(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  status       text not null check (status in ('in','maybe','out')),
  responded_at timestamptz not null default now(),

  primary key (invite_id, user_id)
);

create table friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted','blocked')),
  created_at   timestamptz not null default now(),

  constraint no_self_friendship check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);

-- ---------------------------------------------------------------------------
-- Marketplace. Note the absence of an address column: `meet_area` is a public
-- place label and there is nowhere to put anything else.
-- ---------------------------------------------------------------------------
create table listings (
  id           uuid primary key default gen_random_uuid(),
  city_slug    text not null,
  campus_slug  text,
  seller_id    uuid not null references auth.users(id) on delete cascade,
  title        text not null check (length(title) between 3 and 100),
  detail       text not null check (length(detail) <= 600),
  category     text not null,
  price_cents  bigint not null default 0 check (price_cents >= 0),
  condition    text not null check (condition in ('new','good','used','worn')),
  meet_area    text not null check (length(meet_area) between 3 and 80),
  status       text not null default 'active' check (
                 status in ('active','reserved','sold','withdrawn')
               ),
  from_leaving boolean not null default false,
  created_at   timestamptz not null default now(),
  sold_at      timestamptz
);

create index listings_city_active_idx on listings (city_slug, created_at desc) where status = 'active';

-- ============================================================================
-- PERSONAL
-- ============================================================================

create table saved_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('place','event','deal','plan')),
  target_id     uuid not null,
  collection_id uuid,
  note          text,
  created_at    timestamptz not null default now(),

  unique (user_id, kind, target_id)
);

create table collections (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  emoji         text not null default '📁',
  collaborative boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Inspectable and resettable by design. A recommender a student cannot see or
-- correct is one they stop trusting the first time it is wrong about them.
create table memories (
  user_id                   uuid primary key references auth.users(id) on delete cascade,
  category_affinity         jsonb not null default '{}',
  disliked_place_ids        uuid[] not null default '{}',
  liked_place_ids           uuid[] not null default '{}',
  observed_price_band_cents bigint,
  observed_travel_minutes   int,
  updated_at                timestamptz not null default now()
);

create table arrival_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id text not null,
  done_at timestamptz not null default now(),

  primary key (user_id, task_id)
);

create table notification_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  topics     jsonb not null default '{"budget-warnings": true}',
  quiet_from int not null default 23 check (quiet_from between 0 and 23),
  quiet_to   int not null default 8 check (quiet_to between 0 and 23),
  updated_at timestamptz not null default now()
);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  topic      text not null,
  title      text not null,
  body       text not null,
  href       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx on notifications (user_id, created_at desc)
  where read_at is null;

create table saved_plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  city_slug     text not null,
  title         text not null,
  query         text,
  budget_cents  bigint check (budget_cents >= 0),
  items         jsonb not null default '[]',
  -- Which engine version produced it, so a bad batch can be found later.
  strategy      text not null,
  for_date      timestamptz,
  shared        boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ============================================================================
-- INSIGHT
-- ============================================================================

-- Classified intent only. The raw query is never stored — see
-- `recordSearchMiss`. Demand without surveillance.
create table search_misses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  city_slug    text not null,
  intent       text not null,
  surface      text not null check (surface in ('ask','search','explore','events')),
  result_count int not null default 0,
  created_at   timestamptz not null default now()
);

create table unmet_needs (
  id           uuid primary key default gen_random_uuid(),
  city_slug    text not null,
  campus_slug  text,
  intent       text not null,
  gap          text not null check (
                 gap in ('missing-data','missing-feature','missing-city','low-confidence')
               ),
  -- Distinct students, not distinct queries.
  hits         int not null default 1 check (hits > 0),
  tag          text check (
                 tag in ('potential-feature','missing-data','new-category','city-requirement')
               ),
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),

  unique (city_slug, intent, gap)
);

-- The north-star ledger. One row per genuinely useful thing that happened.
create table useful_outcomes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null,
  detail     text,
  created_at timestamptz not null default now()
);

create index useful_outcomes_user_created_idx on useful_outcomes (user_id, created_at desc);

-- Every model call, with an estimated cost. Without this, AI spend is one line
-- on a vendor invoice with no way to attribute it.
create table ai_usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  operation     text not null,
  tier          smallint not null check (tier between 0 and 3),
  model         text not null,
  input_tokens  int not null default 0,
  output_tokens int not null default 0,
  -- Micro-euros, integer, so summing a million rows stays exact.
  cost_micros   bigint not null default 0,
  cache_hit     boolean not null default false,
  latency_ms    int not null default 0,
  plan          plan_key not null default 'free',
  created_at    timestamptz not null default now()
);

create index ai_usage_user_created_idx on ai_usage (user_id, created_at desc);
create index ai_usage_created_idx on ai_usage (created_at desc);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
-- Enabled on every table holding user data. The default is deny; each policy
-- below is an explicit exception.
-- ============================================================================

alter table profiles            enable row level security;
alter table moves               enable row level security;
alter table subscriptions       enable row level security;
alter table budget_setups       enable row level security;
alter table budget_envelopes    enable row level security;
alter table transactions        enable row level security;
alter table recurring_expenses  enable row level security;
alter table saved_items         enable row level security;
alter table collections         enable row level security;
alter table memories            enable row level security;
alter table arrival_progress    enable row level security;
alter table notification_prefs  enable row level security;
alter table notifications       enable row level security;
alter table saved_plans         enable row level security;
alter table posts               enable row level security;
alter table comments            enable row level security;
alter table votes               enable row level security;
alter table chat_messages       enable row level security;
alter table invites             enable row level security;
alter table invite_responses    enable row level security;
alter table friendships         enable row level security;
alter table listings            enable row level security;
alter table deal_reports        enable row level security;
alter table community_members   enable row level security;
alter table useful_outcomes     enable row level security;
alter table ai_usage            enable row level security;
alter table search_misses       enable row level security;

-- ---------------------------------------------------------------------------
-- The two non-negotiable policies.
-- ---------------------------------------------------------------------------

-- 1. Financial data is readable only by its owner. No exceptions, no admin
--    read path, no "support access" flag.
create policy budget_setups_owner on budget_setups
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy budget_envelopes_owner on budget_envelopes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy transactions_owner on transactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy recurring_owner on recurring_expenses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2. The precise home location is never readable by another user.
--
--    Postgres RLS is row-level, not column-level, so the guarantee is made by
--    granting other users access only through `public_profiles` below, which
--    does not select `home_point` at all. Direct table access is restricted to
--    the owner.
create policy profiles_owner_full on profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke select on profiles from anon, authenticated;
grant select on profiles to authenticated;  -- gated by the policy above

-- The only shape another student can read. `home_point` is structurally absent.
create view public_profiles
with (security_invoker = false) as
select
  p.user_id,
  p.handle,
  p.display_name,
  p.avatar_emoji,
  case when p.show_city then p.city_slug end       as city_slug,
  case when p.show_campus then p.campus_slug end   as campus_slug,
  case when p.show_interests then p.interests end  as interests,
  p.student_verified_at,
  p.terms_in_city,
  p.visibility
from profiles p
where p.visibility <> 'private';

grant select on public_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Owner-only tables
-- ---------------------------------------------------------------------------

create policy moves_owner on moves
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy subscriptions_read_own on subscriptions
  for select using (user_id = auth.uid());
-- Deliberately no insert/update policy: the Stripe webhook writes this table
-- with the service role. A client that could write here could grant itself Max.

create policy saved_owner on saved_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy collections_owner on collections
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy memories_owner on memories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy arrival_owner on arrival_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notification_prefs_owner on notification_prefs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notifications_owner on notifications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy saved_plans_owner on saved_plans
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy outcomes_owner on useful_outcomes
  for select using (user_id = auth.uid());

create policy ai_usage_owner on ai_usage
  for select using (user_id = auth.uid());

create policy search_misses_insert on search_misses
  for insert with check (user_id = auth.uid() or user_id is null);

-- ---------------------------------------------------------------------------
-- Community: readable by any signed-in student, writable as yourself.
-- ---------------------------------------------------------------------------

create policy posts_read on posts
  for select using (hidden_at is null);
create policy posts_insert on posts
  for insert with check (author_id = auth.uid());
create policy posts_update_own on posts
  for update using (author_id = auth.uid());
create policy posts_delete_own on posts
  for delete using (author_id = auth.uid());

create policy comments_read on comments
  for select using (hidden_at is null);
create policy comments_insert on comments
  for insert with check (author_id = auth.uid());
create policy comments_delete_own on comments
  for delete using (author_id = auth.uid());

create policy votes_owner on votes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy chat_read on chat_messages
  for select using (true);
create policy chat_insert on chat_messages
  for insert with check (author_id = auth.uid());

create policy deal_reports_read on deal_reports
  for select using (true);
create policy deal_reports_write_own on deal_reports
  for insert with check (user_id = auth.uid());

create policy community_members_read on community_members
  for select using (true);
create policy community_members_join on community_members
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Anyone Down?: audience-scoped reads, host-only writes.
-- ---------------------------------------------------------------------------

create policy invites_read on invites
  for select using (
    audience = 'city'
    or host_id = auth.uid()
    or (
      audience = 'campus'
      and exists (
        select 1 from profiles me, profiles host
        where me.user_id = auth.uid()
          and host.user_id = invites.host_id
          and me.campus_slug is not null
          and me.campus_slug = host.campus_slug
      )
    )
    or (
      audience = 'friends'
      and exists (
        select 1 from friendships f
        where f.status = 'accepted'
          and (
            (f.requester_id = auth.uid() and f.addressee_id = invites.host_id)
            or (f.addressee_id = auth.uid() and f.requester_id = invites.host_id)
          )
      )
    )
  );

create policy invites_write_own on invites
  for all using (host_id = auth.uid()) with check (host_id = auth.uid());

create policy invite_responses_read on invite_responses
  for select using (true);
create policy invite_responses_own on invite_responses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy friendships_visible on friendships
  for select using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy friendships_request on friendships
  for insert with check (requester_id = auth.uid());
create policy friendships_respond on friendships
  for update using (addressee_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Marketplace
-- ---------------------------------------------------------------------------

create policy listings_read on listings
  for select using (status = 'active' or seller_id = auth.uid());
create policy listings_write_own on listings
  for all using (seller_id = auth.uid()) with check (seller_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Public reference data: readable by everyone, written by the service role.
-- ---------------------------------------------------------------------------

alter table places             enable row level security;
alter table events             enable row level security;
alter table deals              enable row level security;
alter table official_facts     enable row level security;
alter table guides             enable row level security;
alter table price_observations enable row level security;
alter table communities        enable row level security;
alter table facts              enable row level security;

create policy places_read             on places             for select using (true);
create policy events_read             on events             for select using (true);
create policy deals_read              on deals              for select using (true);
create policy official_facts_read     on official_facts     for select using (true);
create policy guides_read             on guides             for select using (true);
create policy price_observations_read on price_observations for select using (true);
create policy communities_read        on communities        for select using (true);
create policy facts_read              on facts              for select using (true);

-- ============================================================================
-- HELPERS
-- ============================================================================

-- Walking minutes between two points, at 78 m/min — the average city walking
-- speed the application also uses. Students think in minutes; a metric
-- distance is a worse answer wearing a lab coat.
create or replace function walking_minutes(a geography, b geography)
returns int
language sql
immutable
parallel safe
as $$
  select greatest(1, round(st_distance(a, b) / 78.0)::int);
$$;

-- Places within a walking-time budget of a point. Index-backed via the gist
-- index on `places.location`.
create or replace function places_within_minutes(
  origin geography,
  minutes int,
  city text
)
returns setof places
language sql
stable
parallel safe
as $$
  select *
  from places
  where city_slug = city
    and st_dwithin(location, origin, minutes * 78.0)
  order by st_distance(location, origin);
$$;
