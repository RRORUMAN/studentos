import "server-only";

import type { Database } from "@/server/db/store";

/**
 * ============================================================================
 * SEEDED LOCAL TRUTH AND QUESTIONS
 * ----------------------------------------------------------------------------
 * Opening claims, the evidence behind each, and a few open questions.
 *
 * The point of seeding these is not to look full. It is that the confidence
 * badge has to be *demonstrably* discriminating on a fresh install: one claim
 * carries three independent recent confirmations and reads Verified, one
 * carries a single confirmation and reads Unconfirmed, and one that was
 * confirmed repeatedly all last term reads Expired because somebody reported
 * it gone this week. A reviewer who cannot watch the layer disagree with
 * itself has no reason to believe it does anything.
 *
 * Everything here is sample content and is covered by the standing seeded-data
 * notice — no row is presented as a live reading of a real shop.
 * ============================================================================
 */

type Seed = {
  seedId: (namespace: string, slug: string) => string;
  iso: (date: Date) => string;
  daysAgo: (days: number, hour?: number) => Date;
};

type Denial = { by: string; agoDays: number; verdict: "gone" | "wrong" | "changed" };

const SEED_CLAIMS: readonly {
  slug: string;
  city: string;
  subject: Database["claims"][number]["subject"];
  statement: string;
  amountCents: number | null;
  author: string;
  agoDays: number;
  confirms: readonly { by: string; agoDays: number }[];
  denials: readonly Denial[];
}[] = [
  {
    slug: "cl1",
    city: "madrid",
    subject: "student-offer",
    statement: "€8 student menu until 15:00 on weekdays — any student card works.",
    amountCents: 800,
    author: "mireia",
    agoDays: 26,
    /* Three separate people, all recent. Reads Verified. */
    confirms: [
      { by: "tobias", agoDays: 3 },
      { by: "samir", agoDays: 6 },
      { by: "aiko", agoDays: 11 },
    ],
    denials: [],
  },
  {
    slug: "cl2",
    city: "madrid",
    subject: "amenity",
    statement: "Plugs at every table upstairs, and nobody minds if you stay three hours.",
    amountCents: null,
    author: "samir",
    agoDays: 40,
    /* One person. Reads Unconfirmed — deliberately, so the badge is visibly
       not decorative. */
    confirms: [{ by: "aiko", agoDays: 9 }],
    denials: [],
  },
  {
    slug: "cl3",
    city: "madrid",
    subject: "student-offer",
    statement: "20% student discount at the counter, no minimum spend.",
    amountCents: null,
    author: "aiko",
    agoDays: 150,
    /* Confirmed repeatedly last term, reported gone this week. The entire
       argument for the truth layer, in one row. */
    confirms: [
      { by: "mireia", agoDays: 120 },
      { by: "tobias", agoDays: 110 },
      { by: "samir", agoDays: 96 },
    ],
    denials: [{ by: "lukas", agoDays: 2, verdict: "gone" }],
  },
  {
    slug: "cl5",
    city: "madrid",
    subject: "student-offer",
    statement: "Cinema Wednesday is €5 with a student card.",
    amountCents: 500,
    author: "tobias",
    agoDays: 95,
    /* Three confirmations, but all from last term. Reads Likely rather than
       Verified, and lands in the verification queue — the case the queue
       exists for is a claim the product is still telling students to act on
       that nobody has checked since the summer. */
    confirms: [
      { by: "mireia", agoDays: 62 },
      { by: "samir", agoDays: 68 },
      { by: "aiko", agoDays: 74 },
    ],
    denials: [],
  },
  {
    slug: "cl6",
    city: "madrid",
    subject: "access",
    statement: "Free entry to the permanent collection with a student card before 18:00.",
    amountCents: null,
    author: "mireia",
    agoDays: 88,
    /* Also stale. Two of these is not padding: a city where nothing has been
       re-checked since last term is exactly what an early-stage city looks
       like, and the verification queue is the product's answer to it. */
    confirms: [
      { by: "samir", agoDays: 55 },
      { by: "tobias", agoDays: 61 },
    ],
    denials: [],
  },
  {
    slug: "cl7",
    city: "madrid",
    subject: "price",
    statement: "A pint in the student bars near the campus is about €2.50.",
    amountCents: 250,
    author: "tobias",
    agoDays: 120,
    confirms: [
      { by: "aiko", agoDays: 70 },
      { by: "mireia", agoDays: 79 },
      { by: "samir", agoDays: 84 },
    ],
    denials: [],
  },
  {
    slug: "cl4",
    city: "berlin",
    subject: "price",
    statement: "A döner near campus is about €6.50 now, not €5.",
    amountCents: 650,
    author: "lukas",
    agoDays: 18,
    confirms: [
      { by: "elena", agoDays: 4 },
      { by: "joran", agoDays: 8 },
    ],
    denials: [],
  },
];

const SEED_QUESTIONS: readonly {
  slug: string;
  city: string;
  campus: string | null;
  asker: string;
  intent: string;
  title: string;
  subject: Database["questions"][number]["expectedSubject"];
  agoHours: number;
  answers: readonly { by: string; body: string; amountCents: number | null; agoHours: number }[];
}[] = [
  {
    slug: "q1",
    city: "madrid",
    campus: "ucm",
    asker: "samir",
    intent: "printing",
    title: "Where can I print 100 pages cheaply near UCM?",
    subject: null,
    agoHours: 6,
    /* Unanswered on purpose: being first to answer is the interaction worth
       demonstrating, and a screen where everything is already answered
       demonstrates nothing. */
    answers: [],
  },
  {
    slug: "q2",
    city: "madrid",
    campus: null,
    asker: "tobias",
    intent: "haircut",
    title: "What does a normal haircut cost in Madrid?",
    subject: "price",
    agoHours: 30,
    /* Two answers within the price tolerance, so `consensusOf` finds agreement
       and the asker sees the loop close. */
    answers: [
      {
        by: "mireia",
        body: "Around €12 at the local places away from the centre. The ones near Sol are double for the same cut.",
        amountCents: 1200,
        agoHours: 24,
      },
      {
        by: "aiko",
        body: "€13 where I go in Lavapiés, no appointment needed.",
        amountCents: 1300,
        agoHours: 20,
      },
    ],
  },
  {
    slug: "q3",
    city: "berlin",
    campus: null,
    asker: "elena",
    intent: "other",
    title: "Anywhere open late to study near Neukölln?",
    subject: null,
    agoHours: 14,
    answers: [],
  },
];

export function seedTruth(db: Database, { seedId, iso, daysAgo }: Seed): void {
  for (const claim of SEED_CLAIMS) {
    const id = seedId("claim", claim.slug);
    const lastConfirm = claim.confirms.length
      ? Math.min(...claim.confirms.map((confirm) => confirm.agoDays))
      : null;

    db.claims.push({
      id,
      citySlug: claim.city,
      campusSlug: null,
      subject: claim.subject,
      targetKind: null,
      targetId: null,
      statement: claim.statement,
      amountCents: claim.amountCents,
      sourceType: "student-report",
      sourceUrl: null,
      submittedBy: seedId("user", claim.author),
      derivedFromQuestionId: null,
      createdAt: iso(daysAgo(claim.agoDays)),
      lastSeenAt: iso(daysAgo(lastConfirm ?? claim.agoDays)),
      lastVerifiedAt: lastConfirm === null ? null : iso(daysAgo(lastConfirm)),
      supersededBy: null,
      status: "published",
    });

    for (const confirm of claim.confirms) {
      db.verifications.push({
        id: seedId("verification", `${claim.slug}:${confirm.by}`),
        claimId: id,
        userId: seedId("user", confirm.by),
        verdict: "confirmed",
        correctionCents: null,
        note: null,
        createdAt: iso(daysAgo(confirm.agoDays)),
      });

      /* Reputation is derived from these verifications rather than asserted
         separately: every row points at a claim somebody really did confirm in
         this same seed. A seeded standing that did not correspond to a real
         contribution is exactly the "points for nothing" the module exists to
         avoid. */
      db.reputationEvents.push({
        id: seedId("reputation", `${claim.slug}:${confirm.by}`),
        userId: seedId("user", confirm.by),
        citySlug: claim.city,
        signal: "place-confirmed",
        refKind: "claim",
        refId: id,
        createdAt: iso(daysAgo(confirm.agoDays)),
      });
    }

    if (lastConfirm !== null) {
      db.reputationEvents.push({
        id: seedId("reputation", `${claim.slug}:author`),
        userId: seedId("user", claim.author),
        citySlug: claim.city,
        signal: "deal-confirmed",
        refKind: "claim",
        refId: id,
        createdAt: iso(daysAgo(lastConfirm)),
      });
    }

    for (const denial of claim.denials) {
      db.verifications.push({
        id: seedId("verification", `${claim.slug}:${denial.by}`),
        claimId: id,
        userId: seedId("user", denial.by),
        verdict: denial.verdict,
        correctionCents: null,
        note: null,
        createdAt: iso(daysAgo(denial.agoDays)),
      });
    }
  }

  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

  for (const question of SEED_QUESTIONS) {
    const id = seedId("question", question.slug);

    db.questions.push({
      id,
      askerId: seedId("user", question.asker),
      citySlug: question.city,
      campusSlug: question.campus,
      audience: question.campus ? "campus" : "city",
      communityId: null,
      intent: question.intent,
      title: question.title,
      detail: null,
      originQuery: null,
      expectedSubject: question.subject,
      status: question.answers.length > 0 ? "answered" : "open",
      acceptedAnswerId: null,
      escalatedAt: null,
      createdAt: iso(hoursAgo(question.agoHours)),
      closedAt: null,
    });

    for (const answer of question.answers) {
      db.answers.push({
        id: seedId("answer", `${question.slug}:${answer.by}`),
        questionId: id,
        userId: seedId("user", answer.by),
        body: answer.body,
        placeId: null,
        amountCents: answer.amountCents,
        usefulCount: 0,
        markedUsefulByAsker: false,
        createdAt: iso(hoursAgo(answer.agoHours)),
      });
    }
  }
}
