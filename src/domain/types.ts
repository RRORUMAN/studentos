import type { PlanKey } from "@/config/pricing";

/**
 * ============================================================================
 * PRODUCT DOMAIN TYPES
 * ----------------------------------------------------------------------------
 * The shapes the authenticated product stores and reads. These mirror the SQL
 * in `supabase/migrations/` one-for-one — every field here exists as a column
 * there, in the same units — so the local store and Postgres are never
 * describing different products.
 *
 * Two conventions that hold across the whole file:
 *
 *   Money is integer minor units (cents). Never a float. A budget that drifts
 *   by a cent per operation is a budget nobody trusts by week three, and
 *   `0.1 + 0.2` is the reason.
 *
 *   Timestamps are ISO-8601 UTC strings. The product is worldwide; a Date
 *   serialised across a server/client boundary in local time is a bug waiting
 *   for a student in Tokyo to find.
 * ============================================================================
 */

export type Id = string;
export type Iso = string;
/** Integer minor units. €18.40 is 1840. */
export type Cents = number;

/* -------------------------------------------------------------------------- */
/* Account                                                                     */
/* -------------------------------------------------------------------------- */

export type User = {
  id: Id;
  email: string;
  /** scrypt digest. Null for accounts created through an OAuth provider. */
  passwordHash: string | null;
  emailVerifiedAt: Iso | null;
  /** "password" | "google" — how the account was created. */
  provider: "password" | "google";
  createdAt: Iso;
  lastSeenAt: Iso;
  /** Set only on the seeded demo account and on explicit promotion. */
  isAdmin: boolean;
};

/**
 * Everything onboarding collects. Deliberately one row rather than a dozen
 * preference tables: it is read on every request that renders Home, and a
 * single row keeps that a single index hit.
 */
export type Profile = {
  userId: Id;
  handle: string;
  displayName: string;
  avatarEmoji: string;
  bio: string | null;

  /* --- step 1: status --------------------------------------------------- */
  studentStatus: StudentStatus;

  /* --- step 2: city ----------------------------------------------------- */
  citySlug: string;
  countryCode: string;
  /** Set when the student has not arrived yet. Drives Arrival Mode. */
  arrivingOn: Iso | null;
  leavingOn: Iso | null;

  /* --- step 3: university ----------------------------------------------- */
  campusSlug: string | null;
  universityName: string | null;

  /* --- step 4: home ------------------------------------------------------
     `homePoint` is the precise coordinate and is NEVER selected by any query
     that can reach another user. `homeArea` is the coarse label that is safe
     to show. The split is structural, not a policy note: see the RLS policy
     `profiles_home_point_owner_only`. */
  homeArea: string | null;
  homePoint: LatLng | null;

  /* --- step 6: financial goals ------------------------------------------ */
  moneyGoals: readonly MoneyGoal[];

  /* --- step 7 & 8: interests and social --------------------------------- */
  interests: readonly string[];
  socialGoals: readonly SocialGoal[];

  /* --- step 9: food ------------------------------------------------------ */
  diets: readonly string[];

  /* --- step 10: transport ------------------------------------------------ */
  transport: readonly TransportMode[];
  /** Upper bound the student will travel for something good, in minutes. */
  maxTravelMinutes: number;

  /* --- step 11: price sensitivity ---------------------------------------- */
  priceSensitivity: PriceSensitivity;

  /* --- money ------------------------------------------------------------- */
  currency: string;
  /** BCP-47 tag for number, date and currency formatting: the city's, not the student's. */
  locale: string;
  /** Interface language code (ISO 639-1). Optional for rows written before it existed. */
  language?: string;

  /* --- verification ------------------------------------------------------ */
  studentVerifiedAt: Iso | null;
  /** Terms in this city. Credibility signal in the community, not a score. */
  termsInCity: number;

  /* --- privacy ----------------------------------------------------------- */
  privacy: PrivacySettings;

  onboardedAt: Iso | null;
  createdAt: Iso;
};

export type StudentStatus =
  | "studying-abroad"
  | "international"
  | "exchange"
  | "home-country"
  | "moving-soon"
  | "other";

export type MoneyGoal =
  | "stop-overspending"
  | "save-more"
  | "track-spending"
  | "cheaper-alternatives"
  | "plan-spending"
  | "budget-weekly"
  | "budget-monthly"
  | "basic-tracking";

export type SocialGoal =
  | "meet-friends"
  | "go-out"
  | "sports"
  | "study-groups"
  | "networking"
  | "travel-buddies"
  | "language-exchange"
  | "campus-events"
  | "private";

export type TransportMode = "walk" | "transit" | "bike" | "scooter" | "car" | "taxi";

export type PriceSensitivity = "cheapest" | "value" | "balanced" | "occasional-splurge";

export type LatLng = { lat: number; lng: number };

export type PrivacySettings = {
  /** Who can see the profile at all. */
  profileVisibility: "public" | "campus" | "friends" | "private";
  showCity: boolean;
  showCampus: boolean;
  showInterests: boolean;
  /** Opt-in to being matched into Anyone Down? suggestions. */
  discoverable: boolean;
};

export const defaultPrivacy: PrivacySettings = {
  profileVisibility: "campus",
  showCity: true,
  showCampus: true,
  showInterests: true,
  discoverable: true,
};

/* -------------------------------------------------------------------------- */
/* Subscription                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The row the server trusts. `plan` here — never a value from the client, a
 * URL or a JWT claim — is what `src/server/entitlements.ts` reads.
 */
export type Subscription = {
  userId: Id;
  plan: PlanKey;
  status: SubscriptionStatus;
  period: "monthly" | "annual";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  /** End of the paid period. Access continues to this instant after cancel. */
  currentPeriodEnd: Iso | null;
  cancelAtPeriodEnd: boolean;
  updatedAt: Iso;
};

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "none";

/**
 * A subscription only grants its tier while it is in good standing. A past_due
 * account keeps access for the grace period Stripe is retrying in, because
 * revoking a student's budget the hour a card expires is hostile and churns
 * people who would have paid.
 */
export function effectivePlan(sub: Subscription | null): PlanKey {
  if (!sub) return "free";
  if (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due") {
    return sub.plan;
  }
  /* Cancelled but still inside the paid period: keep what they bought. */
  if (sub.status === "canceled" && sub.currentPeriodEnd) {
    return Date.parse(sub.currentPeriodEnd) > Date.now() ? sub.plan : "free";
  }
  return "free";
}

/* -------------------------------------------------------------------------- */
/* Money                                                                       */
/* -------------------------------------------------------------------------- */

/** A monthly envelope. One row per user per month per category. */
export type BudgetEnvelope = {
  id: Id;
  userId: Id;
  /** "2026-09". Month granularity: budgets are monthly objects everywhere. */
  month: string;
  category: string;
  plannedCents: Cents;
  /** True for categories the student added themselves (Starter+). */
  custom: boolean;
};

export type Transaction = {
  id: Id;
  userId: Id;
  category: string;
  amountCents: Cents;
  merchant: string | null;
  note: string | null;
  /** Date of spend, not of entry. */
  spentAt: Iso;
  source: TransactionSource;
  /** Set when the row came out of a scanned receipt. */
  receiptId: Id | null;
  createdAt: Iso;
};

export type TransactionSource = "manual" | "receipt" | "recurring" | "import";

/** A repeating charge. Expanded into transactions by a background job. */
export type RecurringExpense = {
  id: Id;
  userId: Id;
  label: string;
  category: string;
  amountCents: Cents;
  cadence: "weekly" | "monthly" | "termly";
  /** Day of month (monthly) or day of week 0-6 (weekly). */
  dayOfPeriod: number;
  active: boolean;
  createdAt: Iso;
};

/** The budget setup captured at onboarding, kept so it can be re-run. */
export type BudgetSetup = {
  userId: Id;
  mode: "simple" | "detailed";
  monthlyTotalCents: Cents;
  /** True when housing is paid separately and excluded from the envelope. */
  excludeHousing: boolean;
  updatedAt: Iso;
};

/* -------------------------------------------------------------------------- */
/* Places, events, deals                                                       */
/* -------------------------------------------------------------------------- */

export type EventKind =
  | "music"
  | "nightlife"
  | "networking"
  | "sports"
  | "university"
  | "culture"
  | "tech"
  | "food"
  | "social"
  | "outdoor";

export type CityEvent = {
  id: Id;
  citySlug: string;
  campusSlug: string | null;
  title: string;
  blurb: string;
  kind: EventKind;
  /** Zero is a real, common and important answer. Never null for "free". */
  priceCents: Cents;
  startsAt: Iso;
  endsAt: Iso | null;
  venue: string;
  /** Coarse venue coordinate. Venues are public; this is not sensitive. */
  point: LatLng;
  /** Where the row came from, printed in the UI next to the event. */
  source: "students" | "official" | "venue";
  sourceUrl: string | null;
  /** Independent student confirmations. Drives the verified badge. */
  confirmations: number;
  interested: number;
  tags: readonly string[];
  /** When the row was last confirmed accurate. Stale events are demoted. */
  observedAt: Iso;
  /** An image the source published for this event. Never a stock photo; null renders the kind field. */
  imageUrl?: string | null;
  /** Set on ingested rows: the feed it came from and its id inside that feed. */
  sourceId?: Id | null;
  externalId?: string | null;
};

export type Deal = {
  id: Id;
  citySlug: string;
  placeId: Id | null;
  title: string;
  detail: string;
  /** "20%", "€5 lunch", "2-for-1". Free text because deals are not uniform. */
  value: string;
  category: string;
  requiresStudentId: boolean;
  expiresAt: Iso | null;
  source: "students" | "official" | "venue";
  confirmations: number;
  submittedBy: Id | null;
  /** A community deal is not shown as verified until it is confirmed. */
  verifiedAt: Iso | null;
  createdAt: Iso;
};

/**
 * Interested / Going on an event. One row per student per event; switching
 * status updates the row rather than adding a second one. "Going" is what
 * opens the event chat, so it is a real commitment rather than a like.
 */
export type EventResponse = {
  eventId: Id;
  userId: Id;
  status: "interested" | "going";
  respondedAt: Iso;
};

/* -------------------------------------------------------------------------- */
/* Saved                                                                       */
/* -------------------------------------------------------------------------- */

export type SavedKind = "place" | "event" | "deal" | "plan" | "listing" | "post";

export type SavedItem = {
  id: Id;
  userId: Id;
  kind: SavedKind;
  targetId: Id;
  collectionId: Id | null;
  note: string | null;
  createdAt: Iso;
};

export type Collection = {
  id: Id;
  userId: Id;
  name: string;
  emoji: string;
  /** Plus: other users may add to it. */
  collaborative: boolean;
  createdAt: Iso;
};

/* -------------------------------------------------------------------------- */
/* Community                                                                   */
/* -------------------------------------------------------------------------- */

export type CommunityPost = {
  id: Id;
  citySlug: string;
  campusSlug: string | null;
  channel: string;
  authorId: Id;
  kind: "question" | "deal" | "event" | "recommendation" | "anyone-down" | "poll" | "post";
  title: string;
  body: string | null;
  placeId: Id | null;
  upvotes: number;
  commentCount: number;
  /** Soft moderation. Hidden rows stay for audit; they are never selected. */
  hiddenAt: Iso | null;
  /** Poll options, for kind "poll". Votes live in `pollVotes`. */
  poll?: readonly string[] | null;
  /** Something the post points at. Rendered from the live row, never copied. */
  attachment?: ChatAttachment | null;
  createdAt: Iso;
};

/** One student, one poll, one option. Changing your vote updates the row. */
export type PollVote = {
  postId: Id;
  userId: Id;
  optionIndex: number;
  createdAt: Iso;
};

export type Comment = {
  id: Id;
  postId: Id;
  parentId: Id | null;
  authorId: Id;
  body: string;
  upvotes: number;
  hiddenAt: Iso | null;
  createdAt: Iso;
};

export type Vote = {
  userId: Id;
  targetKind: "post" | "comment";
  targetId: Id;
  value: 1 | -1;
  createdAt: Iso;
};

/**
 * Something a message points at. Always a reference to a real row, never a
 * copy of it: the card renders from the live event or place so a price change
 * shows up in a three-day-old message too.
 */
export type ChatAttachment = {
  kind: "event" | "place" | "plan" | "deal" | "invite" | "listing" | "poll" | "mission";
  id: Id;
};

/** A poll posted into a chat channel. Options are fixed at creation. */
export type ChatPoll = {
  id: Id;
  channel: string;
  authorId: Id;
  question: string;
  options: readonly string[];
  closesAt: Iso | null;
  createdAt: Iso;
};

export type ChatPollVote = {
  pollId: Id;
  userId: Id;
  optionIndex: number;
  createdAt: Iso;
};

export type ChatMessageRow = {
  id: Id;
  citySlug: string;
  channel: string;
  authorId: Id;
  body: string;
  replyToId: Id | null;
  attachment?: ChatAttachment | null;
  createdAt: Iso;
};

/** One emoji from one person on one message. Toggling removes the row. */
export type ChatReaction = {
  messageId: Id;
  userId: Id;
  emoji: string;
  createdAt: Iso;
};

/** Per-person, per-channel state: pinned, muted, archived, last read. */
export type ChatPrefs = {
  userId: Id;
  channel: string;
  pinned: boolean;
  muted: boolean;
  archived: boolean;
  lastReadAt: Iso | null;
  updatedAt: Iso;
};

/* -------------------------------------------------------------------------- */
/* Anyone Down?                                                                */
/* -------------------------------------------------------------------------- */

export type Invite = {
  id: Id;
  citySlug: string;
  hostId: Id;
  title: string;
  detail: string | null;
  /** What it is attached to, if anything. */
  anchorKind: "place" | "event" | "plan" | null;
  anchorId: Id | null;
  startsAt: Iso;
  /** Who can see it. The core social loop is free at every tier. */
  audience: "friends" | "campus" | "city";
  capacity: number;
  budgetCents: Cents | null;
  /** Groups are temporary by design; they close after the thing happens. */
  closesAt: Iso;
  createdAt: Iso;
};

export type InviteResponse = {
  inviteId: Id;
  userId: Id;
  status: "in" | "maybe" | "out";
  respondedAt: Iso;
};

export type Friendship = {
  id: Id;
  requesterId: Id;
  addresseeId: Id;
  status: "pending" | "accepted" | "blocked";
  createdAt: Iso;
};

/* -------------------------------------------------------------------------- */
/* Plans                                                                       */
/* -------------------------------------------------------------------------- */

export type SavedPlanItem = {
  time: string;
  title: string;
  detail: string | null;
  priceCents: Cents;
  walkMinutes: number | null;
  kind: "food" | "event" | "drink" | "transport" | "culture" | "activity";
  source: "students" | "official" | "venue";
  /** The row this line was built from, so the plan can link back. */
  refKind: "place" | "event" | null;
  refId: Id | null;
};

export type SavedPlan = {
  id: Id;
  userId: Id;
  citySlug: string;
  title: string;
  query: string | null;
  budgetCents: Cents | null;
  items: readonly SavedPlanItem[];
  /** Which engine produced it, so a bad batch can be found later. */
  strategy: string;
  forDate: Iso | null;
  shared: boolean;
  createdAt: Iso;
};

/** Someone invited to, or in, a plan. The owner is implicitly "in". */
export type PlanMember = {
  planId: Id;
  userId: Id;
  status: "invited" | "in" | "out";
  updatedAt: Iso;
};

/** A vote on one line of a plan, so a group can pick between options. */
export type PlanVote = {
  planId: Id;
  userId: Id;
  /** Index into `SavedPlan.items`. */
  itemIndex: number;
  value: 1 | -1;
  createdAt: Iso;
};

/* -------------------------------------------------------------------------- */
/* Arrival                                                                     */
/* -------------------------------------------------------------------------- */

export type ArrivalProgress = {
  userId: Id;
  taskId: string;
  doneAt: Iso;
};

/* -------------------------------------------------------------------------- */
/* Notifications                                                               */
/* -------------------------------------------------------------------------- */

export type NotificationTopic =
  | "free-events"
  | "deals"
  | "budget-warnings"
  | "friends-plans"
  | "campus"
  | "pulse"
  | "weekend-ideas"
  | "arrival"
  | "plans";

export const notificationTopics: readonly NotificationTopic[] = [
  "budget-warnings",
  "free-events",
  "deals",
  "friends-plans",
  "plans",
  "campus",
  "pulse",
  "arrival",
  "weekend-ideas",
];

/** How a topic reaches the student. "digest" batches into one daily note. */
export type NotificationDelivery = "instant" | "digest" | "off";

export type NotificationPrefs = {
  userId: Id;
  /** Topic -> enabled. Nothing is on by default that was not asked for. */
  topics: Record<NotificationTopic, boolean>;
  /**
   * Topic -> delivery. Optional for rows written before it existed; readers
   * treat a missing entry as "instant" when the topic is on.
   */
  delivery?: Partial<Record<NotificationTopic, NotificationDelivery>>;
  /** Quiet hours in the student's local time, 0-23. */
  quietFrom: number;
  quietTo: number;
  /** When the last daily digest email went out. Null until the first one. */
  digestSentAt?: Iso | null;
  updatedAt: Iso;
};

/**
 * Resolve how a topic is delivered from a prefs row, tolerating older rows.
 * Off is off regardless of the delivery field; a topic that is on with no
 * delivery entry is instant.
 */
export function deliveryFor(
  prefs: Pick<NotificationPrefs, "topics" | "delivery"> | null,
  topic: NotificationTopic,
): NotificationDelivery {
  if (!prefs) return topic === "budget-warnings" ? "instant" : "off";
  if (!prefs.topics[topic]) return "off";
  return prefs.delivery?.[topic] ?? "instant";
}

export type Notification = {
  id: Id;
  userId: Id;
  topic: NotificationTopic;
  title: string;
  body: string;
  href: string | null;
  readAt: Iso | null;
  createdAt: Iso;
};

/* -------------------------------------------------------------------------- */
/* AI accounting                                                               */
/* -------------------------------------------------------------------------- */

export type AiOperation =
  | "classify"
  | "extract"
  | "summarize"
  | "recommend"
  | "plan"
  | "budget"
  | "mission"
  | "moderate";

/* -------------------------------------------------------------------------- */
/* Ask history                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * One question a student asked, with the intent it resolved to. Kept so Ask
 * can show "recent" and offer follow-ups. The raw query is the student's own
 * and stays on their row; it is never aggregated — that is what `searchMisses`
 * and its classified intent are for.
 */
export type AskHistoryRow = {
  id: Id;
  userId: Id;
  query: string;
  intent: string;
  /** One line the console can show without re-running the ask. */
  summary: string;
  tier: 0 | 1 | 2 | 3;
  createdAt: Iso;
};

/* -------------------------------------------------------------------------- */
/* Follows                                                                     */
/* -------------------------------------------------------------------------- */

/** One-directional. Following is public reading; friendship is mutual. */
export type Follow = {
  followerId: Id;
  followeeId: Id;
  createdAt: Iso;
};

/**
 * One row per model call. This table is the reason the business can answer
 * "what does a free user cost us?" — without it, AI spend is a single line on
 * a vendor invoice with no way to attribute it.
 */
export type AiUsage = {
  id: Id;
  userId: Id | null;
  operation: AiOperation;
  /** Which routing tier served it. Tier 0 means no model was called at all. */
  tier: 0 | 1 | 2 | 3;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Micro-euros. Integer, so summing a million rows stays exact. */
  costMicros: number;
  cacheHit: boolean;
  latencyMs: number;
  plan: PlanKey;
  createdAt: Iso;
};

/* -------------------------------------------------------------------------- */
/* Monetisation                                                                */
/* -------------------------------------------------------------------------- */

/**
 * One value-first upsell shown at a moment of intent. Joined against the
 * subscription row later to answer "which moments convert?".
 */
export type UpgradeTriggerRow = {
  id: Id;
  userId: Id;
  trigger: string;
  feature: string;
  planAtTime: PlanKey;
  shownAt: Iso;
};

/** One admin-editable setting. Namespaced key, string value, see `queries/settings.ts`. */
export type AdminSetting = { key: string; value: string; updatedAt: Iso };

/* -------------------------------------------------------------------------- */
/* Auth support                                                                */
/* -------------------------------------------------------------------------- */

export type AuthToken = {
  /** The hash of the token. The plaintext is only ever in the email. */
  tokenHash: string;
  userId: Id;
  kind: "verify-email" | "reset-password" | "magic-link";
  expiresAt: Iso;
  consumedAt: Iso | null;
  createdAt: Iso;
};

export type Session = {
  id: Id;
  /**
   * SHA-256 of the session token. The plaintext token exists only in the
   * cookie, so a leaked database yields no usable sessions.
   */
  tokenHash: string;
  userId: Id;
  expiresAt: Iso;
  /** Coarse client hint for the "signed-in devices" list. Never an IP. */
  userAgent: string | null;
  createdAt: Iso;
};

/* -------------------------------------------------------------------------- */
/* Events (product analytics, server-side)                                     */
/* -------------------------------------------------------------------------- */

/**
 * The north-star ledger. One row per *useful outcome*, which is the metric the
 * product is steered by — not page views. See `src/server/metrics.ts`.
 */
export type UsefulOutcome = {
  id: Id;
  userId: Id;
  kind:
    | "found-place"
    | "saved-money"
    | "event-saved"
    | "plan-created"
    | "joined-activity"
    | "used-deal"
    | "budget-action"
    | "friend-connected"
    | "community-contribution";
  detail: string | null;
  createdAt: Iso;
};

/* -------------------------------------------------------------------------- */
/* Operations: ingestion, verification, reports, push                          */
/* -------------------------------------------------------------------------- */

/**
 * Where ingested events come from. Every connector reads a public feed the
 * source itself publishes — a university calendar, a city open-data set —
 * and the row it produces carries this source so the UI can print it.
 */
export type SourceKind = "ical" | "madrid-agenda";

export type EventSource = {
  id: Id;
  citySlug: string;
  campusSlug: string | null;
  kind: SourceKind;
  url: string;
  label: string;
  /** Applied to every event from this source when the feed does not say. */
  defaultKind: EventKind;
  tags: readonly string[];
  /** "official" for a public body or university, "venue" for a venue's own feed. */
  trust: "official" | "venue";
  enabled: boolean;
  createdAt: Iso;
  lastSyncAt: Iso | null;
  lastStatus: "never" | "ok" | "error";
  lastMessage: string | null;
  lastCount: number;
};

export type SourceCheckStatus = "ok" | "changed" | "unreachable";

/** The last known state of an official page the product cites. One row per URL. */
export type SourceCheck = {
  url: string;
  status: SourceCheckStatus;
  httpStatus: number | null;
  contentHash: string | null;
  checkedAt: Iso;
  changedAt: Iso | null;
  /** Set when an admin confirmed the current page still supports what we say. */
  reviewedAt: Iso | null;
};

export type ReportTargetKind =
  | "place"
  | "event"
  | "deal"
  | "official-fact"
  | "guide"
  | "source"
  | "listing"
  | "post"
  | "comment"
  | "user";
export type ReportReason =
  | "wrong-price"
  | "closed"
  | "wrong-hours"
  | "wrong-info"
  | "expired"
  | "source-changed"
  | "scam"
  | "spam"
  | "harassment"
  | "unsafe"
  | "other";

/** "Wrong info", from a student or from the verification job. */
export type ContentReport = {
  id: Id;
  /** Null for reports raised by a job rather than a student. */
  userId: Id | null;
  targetKind: ReportTargetKind;
  targetId: string;
  reason: ReportReason;
  note: string | null;
  status: "open" | "resolved" | "dismissed";
  createdAt: Iso;
  resolvedAt: Iso | null;
  resolution: string | null;
};

/** One student, one target, once. The count behind "confirmed by N students". */
export type Confirmation = {
  userId: Id;
  targetKind: "place" | "event";
  targetId: string;
  createdAt: Iso;
};

/** One device. The endpoint is the secret; it is never returned to a client. */
export type PushSubscriptionRow = {
  id: Id;
  userId: Id;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  createdAt: Iso;
  lastUsedAt: Iso | null;
  failures: number;
};
