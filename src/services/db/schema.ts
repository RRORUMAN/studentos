/**
 * ============================================================================
 * DATA ARCHITECTURE — Supabase / PostgreSQL
 * ----------------------------------------------------------------------------
 * The shape the product is being built towards. Kept in the repo as types plus
 * a documented DDL sketch so the marketing components and the eventual live
 * components read the same rows.
 *
 * Extensions the design depends on:
 *   postgis    geography(Point,4326) on places and posts, so "within 15 walking
 *              minutes" is an index-backed query rather than a client filter.
 *   pgvector   embedding vector(1536) on facts, for retrieval before the model
 *              is called. Retrieval is what makes an answer sourceable.
 *
 * Row Level Security is assumed on every table. The two non-negotiable
 * policies: budget rows are readable only by their owner, and location history
 * is never readable by another user under any policy.
 *
 * Realtime channels:
 *   pulse:{city}        new posts and vote counts
 *   chat:{city}         city chat
 *   invite:{inviteId}   Anyone Down? attendance, so a group fills live
 * ============================================================================
 */

export type Uuid = string;
export type Timestamp = string;

export type ProfileRow = {
  id: Uuid;
  handle: string;
  display_name: string | null;
  city_slug: string;
  campus_slug: string | null;
  /** Terms in this city. Drives the credibility chip, not a follower count. */
  terms_in_city: number;
  home_country: string | null;
  created_at: Timestamp;
};

export type PlaceRow = {
  id: Uuid;
  city_slug: string;
  name: string;
  category: string;
  layers: string[];
  typical_price_cents: number | null;
  /** geography(Point,4326) */
  location: unknown;
  /** Denormalised count of independent student confirmations. */
  verified_by: number;
  created_at: Timestamp;
};

export type PostRow = {
  id: Uuid;
  city_slug: string;
  campus_slug: string | null;
  author_id: Uuid;
  kind: "event" | "deal" | "looking-for" | "question" | "tip" | "warning" | "poll";
  title: string;
  body: string | null;
  place_id: Uuid | null;
  starts_at: Timestamp | null;
  price_cents: number | null;
  upvotes: number;
  comment_count: number;
  created_at: Timestamp;
};

/**
 * The knowledge table. Every retrievable statement, with its provenance and
 * an embedding. `confirmations` is what earns a Student Verified badge; a
 * single post never does.
 */
export type FactRow = {
  id: Uuid;
  city_slug: string;
  subject_place_id: Uuid | null;
  statement: string;
  source: "students" | "official" | "venue";
  source_url: string | null;
  confirmations: number;
  /** vector(1536) */
  embedding: unknown;
  observed_at: Timestamp;
  /** Facts expire. A price from two years ago is not a fact. */
  expires_at: Timestamp | null;
};

export type BudgetRow = {
  id: Uuid;
  user_id: Uuid;
  month: string;
  category: string;
  planned_cents: number;
  spent_cents: number;
};

export type InviteRow = {
  id: Uuid;
  city_slug: string;
  host_id: Uuid;
  title: string;
  starts_at: Timestamp;
  place_id: Uuid | null;
  capacity: number;
  /** Temporary groups close after the plan happens. */
  closes_at: Timestamp;
};

export type InviteAttendeeRow = {
  invite_id: Uuid;
  user_id: Uuid;
  status: "in" | "maybe" | "out";
  responded_at: Timestamp;
};

/**
 * The confirmation threshold behind the Student Verified badge. Exported so
 * the badge component and the ingestion job cannot drift apart.
 */
export const STUDENT_VERIFIED_THRESHOLD = 10;

export function isStudentVerified(confirmations: number): boolean {
  return confirmations >= STUDENT_VERIFIED_THRESHOLD;
}
