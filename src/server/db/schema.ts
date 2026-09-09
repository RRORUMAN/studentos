/**
 * ============================================================================
 * SCHEMA
 * ----------------------------------------------------------------------------
 * The shape of the store, and nothing else.
 *
 * It lives apart from any one implementation because there are now two: the
 * JSON file in `store.ts`, which is the development and test default, and the
 * Postgres row store in `supabase-store.ts`, which is what a deployment with
 * Supabase credentials runs on. Both speak this shape, and `access.ts` picks
 * between them. Keeping the shape here is what stops that choice from being a
 * cycle.
 * ============================================================================
 */

import "server-only";

import type { Move } from "@/domain/lifecycle";
import type { LifeOpsTask } from "@/domain/lifeops";
import type { Mission, MissionStep } from "@/domain/missions";
import type { DealReport, Guide, OfficialFact, PriceObservation } from "@/domain/knowledge";
import type { Claim, Verification } from "@/domain/truth";
import type { InstitutionSubmission } from "@/domain/institutions";
import type { LanguageProfile, PhraseProgress } from "@/domain/language";
import type { Answer, Question } from "@/domain/questions";
import type {
  Application,
  Employer,
  Opportunity,
  ProviderRun,
  WorkProfile,
} from "@/domain/work";
import type { ReputationEvent } from "@/domain/reputation";
import type {
  Challenge,
  ChallengeEntry,
  Exploration,
  SearchMiss,
  UnmetNeed,
} from "@/domain/insight";
import type {
  Bucket,
  BucketEntry,
  Community,
  CommunityMember,
  Group,
  GroupMember,
  Listing,
  Memory,
} from "@/domain/social";
import type {
  AdminSetting,
  ArrivalProgress,
  AskHistoryRow,
  AiUsage,
  AuthToken,
  Confirmation,
  ContentReport,
  Follow,
  BudgetEnvelope,
  BudgetSetup,
  ChatMessageRow,
  ChatPoll,
  ChatPollVote,
  ChatPrefs,
  ChatReaction,
  Collection,
  Comment,
  CommunityPost,
  CityEvent,
  Deal,
  EventResponse,
  Friendship,
  Invite,
  InviteResponse,
  Notification,
  NotificationPrefs,
  PlanMember,
  PlanVote,
  PollVote,
  Profile,
  RecurringExpense,
  SavedItem,
  SavedPlan,
  Session,
  Subscription,
  Transaction,
  UpgradeTriggerRow,
  UsefulOutcome,
  User,
  Vote,
  WaitlistEntry,
} from "@/domain/types";

/* -------------------------------------------------------------------------- */
/* Shape                                                                       */
/* -------------------------------------------------------------------------- */

export type Database = {
  /** Bumped when a migration changes the on-disk shape. */
  version: number;
  users: User[];
  sessions: Session[];
  authTokens: AuthToken[];
  profiles: Profile[];
  subscriptions: Subscription[];
  budgetSetups: BudgetSetup[];
  envelopes: BudgetEnvelope[];
  transactions: Transaction[];
  recurring: RecurringExpense[];
  events: CityEvent[];
  deals: Deal[];
  saved: SavedItem[];
  collections: Collection[];
  posts: CommunityPost[];
  comments: Comment[];
  votes: Vote[];
  chat: ChatMessageRow[];
  chatReactions: ChatReaction[];
  chatPrefs: ChatPrefs[];
  eventResponses: EventResponse[];
  invites: Invite[];
  inviteResponses: InviteResponse[];
  friendships: Friendship[];
  plans: SavedPlan[];
  planMembers: PlanMember[];
  planVotes: PlanVote[];
  arrival: ArrivalProgress[];
  notifications: Notification[];
  notificationPrefs: NotificationPrefs[];
  aiUsage: AiUsage[];
  outcomes: UsefulOutcome[];
  upgradeTriggers: UpgradeTriggerRow[];
  adminSettings: AdminSetting[];
  /** Stripe event ids already processed. The idempotency guard for webhooks. */
  processedStripeEvents: { id: string; at: string }[];

  /* --- lifecycle --------------------------------------------------------- */
  moves: Move[];

  /* --- knowledge --------------------------------------------------------- */
  officialFacts: OfficialFact[];
  guides: Guide[];
  dealReports: DealReport[];
  priceObservations: PriceObservation[];

  /* --- social ------------------------------------------------------------ */
  communities: Community[];
  communityMembers: CommunityMember[];
  groups: Group[];
  groupMembers: GroupMember[];
  buckets: Bucket[];
  bucketEntries: BucketEntry[];
  listings: Listing[];
  memories: Memory[];

  /* --- insight ----------------------------------------------------------- */
  searchMisses: SearchMiss[];
  unmetNeeds: UnmetNeed[];
  challenges: Challenge[];
  challengeEntries: ChallengeEntry[];
  explorations: Exploration[];

  /* --- lifeops and missions ---------------------------------------------- */
  lifeopsTasks: LifeOpsTask[];
  missions: Mission[];
  missionSteps: MissionStep[];

  /* --- local truth --------------------------------------------------------
     The moat. `claims` is every assertion a student made about a city and
     `verifications` is every time someone else checked one. `reputationEvents`
     is the ledger that decides whose check counts for how much. All three are
     append-mostly: rows are superseded and retired, never rewritten, because
     the history of a price IS the product. */
  claims: Claim[];
  verifications: Verification[];
  reputationEvents: ReputationEvent[];

  /* --- ask students ------------------------------------------------------- */
  questions: Question[];
  answers: Answer[];

  /* --- ask, follows, trust ------------------------------------------------ */
  askHistory: AskHistoryRow[];

  /* --- work ------------------------------------------------------------- */
  opportunities: Opportunity[];
  employers: Employer[];
  workProfiles: WorkProfile[];
  applications: Application[];
  providerRuns: ProviderRun[];
  follows: Follow[];
  contentReports: ContentReport[];
  confirmations: Confirmation[];
  pollVotes: PollVote[];
  chatPolls: ChatPoll[];
  chatPollVotes: ChatPollVote[];

  /* --- speak local ---------------------------------------------------------
     One profile per student saying which language they are learning, and one
     row per phrase they have done something with. Nothing is written just for
     having seen a phrase on Home -- see `src/server/actions/language.ts`. */
  languageProfiles: LanguageProfile[];
  phraseProgress: PhraseProgress[];

  /* --- institutions -------------------------------------------------------
     Only the SUBMISSIONS live in the store. The registry itself is a data file
     built by `scripts/import-institutions.mjs`: a few hundred rows that change
     when somebody re-runs an import, not when a student does something. */
  institutionSubmissions: InstitutionSubmission[];

  /* --- waitlist ----------------------------------------------------------- */
  waitlist: WaitlistEntry[];
};

export const DATABASE_VERSION = 2;

export function emptyDatabase(): Database {
  return {
    version: DATABASE_VERSION,
    users: [],
    sessions: [],
    authTokens: [],
    profiles: [],
    subscriptions: [],
    budgetSetups: [],
    envelopes: [],
    transactions: [],
    recurring: [],
    events: [],
    deals: [],
    saved: [],
    collections: [],
    posts: [],
    comments: [],
    votes: [],
    chat: [],
    chatReactions: [],
    chatPrefs: [],
    eventResponses: [],
    invites: [],
    inviteResponses: [],
    friendships: [],
    plans: [],
    planMembers: [],
    planVotes: [],
    arrival: [],
    notifications: [],
    notificationPrefs: [],
    aiUsage: [],
    outcomes: [],
    upgradeTriggers: [],
    adminSettings: [],
    processedStripeEvents: [],
    moves: [],
    officialFacts: [],
    guides: [],
    dealReports: [],
    priceObservations: [],
    communities: [],
    communityMembers: [],
    groups: [],
    groupMembers: [],
    buckets: [],
    bucketEntries: [],
    listings: [],
    memories: [],
    searchMisses: [],
    unmetNeeds: [],
    challenges: [],
    challengeEntries: [],
    explorations: [],
    lifeopsTasks: [],
    missions: [],
    missionSteps: [],
    claims: [],
    verifications: [],
    reputationEvents: [],
    questions: [],
    answers: [],
    askHistory: [],
    opportunities: [],
    employers: [],
    workProfiles: [],
    applications: [],
    providerRuns: [],
    follows: [],
    contentReports: [],
    confirmations: [],
    pollVotes: [],
    chatPolls: [],
    chatPollVotes: [],
    languageProfiles: [],
    phraseProgress: [],
    institutionSubmissions: [],
    waitlist: [],
  };
}

export type TableName = {
  [K in keyof Database]: Database[K] extends unknown[] ? K : never;
}[keyof Database];

/* -------------------------------------------------------------------------- */
/* File location                                                               */
/* -------------------------------------------------------------------------- */

export type Persistence = "disk" | "ephemeral";

/* -------------------------------------------------------------------------- */
/* The contract both stores implement                                          */
/* -------------------------------------------------------------------------- */

/**
 * What a store has to be able to do, independent of where the bytes live.
 *
 * Two implementations satisfy it. `JsonStore` keeps one file on disk and is the
 * development and test default. `SupabaseStore` keeps one row per record in
 * Postgres and is what runs when the deployment has Supabase credentials.
 * `access.ts` chooses, and the eight functions every call site uses are written
 * against this interface rather than either one.
 *
 * `read` and `write` are the whole surface on purpose. A store that also
 * offered "query" would have two paths to keep correct, and the predicates the
 * application is written in do not survive translation to SQL anyway — they are
 * closures over request state. So both implementations do the same thing:
 * materialise the table, hand it to the caller's function, and take the
 * difference afterwards.
 */
export interface StudentOsStore {
  registerSeeder(seeder: (db: Database) => void | Promise<void>): void;
  registerMigrator(migrator: (db: Database, from: number) => void | Promise<void>): void;

  /** Materialise the database, seeding it the first time. */
  load(): Promise<Database>;

  /** Read-only access. Callers must not mutate what they receive. */
  read<T>(select: (db: Database) => T): Promise<T>;

  /**
   * The only mutation entry point. Runs `mutate` against the database and
   * persists whatever it changed, serialised against other writers.
   */
  write<T>(mutate: (db: Database) => T | Promise<T>): Promise<T>;

  /** `disk` when writes outlive the process, `ephemeral` when they do not. */
  persistence(): Promise<Persistence>;

  /**
   * Prove the store is actually reachable, cheaply enough to be called by an
   * uptime monitor every minute.
   *
   * Deliberately not `load()`. Loading materialises the whole database, which
   * on a cold instance is the most expensive thing the process does, and a
   * health check that costs a full dump is a health check somebody turns off.
   * Each implementation picks the smallest round trip that would fail if the
   * store were gone, so a green answer means something.
   */
  ping(): Promise<StorePing>;

  /** Drop any in-memory copy so the next read goes back to the source. */
  reset(): void;
}

/**
 * The result of a reachability probe.
 *
 * `error` carries the real reason on failure, because "unhealthy" with no
 * cause is a page somebody has to reproduce by hand at three in the morning.
 * It is returned to `/api/health`, which is public, so the implementations keep
 * it to a transport-level description and never echo credentials.
 */
export type StorePing =
  | { ok: true; kind: "file" | "supabase"; ms: number }
  | { ok: false; kind: "file" | "supabase"; ms: number; error: string };
