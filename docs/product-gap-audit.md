# Product gap audit

Scored against the framework: **student value · frequency · network effect ·
retention · virality · data moat ÷ operating cost**. Ordered by what actually
moves the product, not by section number.

---

## What the audit found

Two distinct kinds of gap, and they need different fixes.

**Gap type 1 — logic with no surface.** Tested domain code nobody can reach:
`settleBucket` (unit-tested, zero UI), groups, communities, challenges,
exploration, weekly and semester recaps, `Memory`, `PriceObservation`,
`Friendship`. This is the cheapest value in the codebase: the hard part is
written and the missing part is a screen.

**Gap type 2 — lifecycle holes.** Whole jobs the product does not do: a reason
to open it on a Tuesday morning, a €0 surface, an answer to "where is my money
going", a weekly grocery habit, a way to ask other students something.

---

## Priority 1 — daily and weekly return

The product had no reason to be opened on a day with nothing planned.

| Feature | Why it wins | Cost |
|---|---|---|
| **Daily Brief** | The single strongest retention mechanism available. One screen: safe today, what is free, who is out, one pending task. Pure arithmetic. | Tier 0 |
| **Free Mode** (`/free`) | "What can I do for €0" is the most-asked question this audience has. It was a filter buried in Events; it deserves a destination. | Tier 0 |
| **Money-saving engine** | "You spent €74 on lunch; here are three cheaper places near campus, ~€25/week." Turns a passive budget into an active one, and is the clearest Starter justification in the product. | Tier 0 |
| **Groceries** (`/groceries`) | A genuine weekly ritual, and the natural home for the price graph. | Tier 0 |

## Priority 2 — network effects

Everything here gets better as more students join, which is what makes the
product hard to replace with Google or Reddit.

| Feature | Why it wins | Cost |
|---|---|---|
| **Ask Students** | Connects the AI answer to real people. Creates UGC, notifications, return visits, and proprietary answers no general model has. | Tier 0 + existing |
| **Friends** | Nothing "friends-aware" worked because there was no way to become friends. Unblocks matching, groups, and the community signal in scoring. | Tier 0 |
| **Groups + shared buckets** | Four people with a shared group and a settled bucket do not each churn independently. `settleBucket` was already written and tested. | Tier 0 |
| **Communities + Campus** | Relevance without fragmenting the feed. Campus is the highest-conversion social unit a new student has. | Tier 0 |

## Priority 3 — trust and the lifecycle tails

| Feature | Why it wins | Cost |
|---|---|---|
| **Safety hub + emergency card** | Cheap, high-trust, genuinely needed at 23:00 in an unfamiliar city. Offline-first by design. | Tier 0 |
| **Housing intelligence** | Deliberately *not* a marketplace: neighbourhood affordability, commute-to-campus, a rent-share calculator. Avoids publishing unverified claims about landlords. | Tier 0 |
| **Study** | Exam-period mode is a real seasonal need and nothing else in the product covers it. | Tier 0 |
| **Trips** | Students travel constantly. Planning architecture only — no expensive travel APIs as an MVP dependency. | Tier 2, Max |

## Priority 4 — planning and play

| Feature | Why it wins | Cost |
|---|---|---|
| **Weekly / weekend planner** | The clearest Starter and Plus feature: a whole week built from budget, interests and what is on. | Tier 2 |
| **Recap + semester share card** | The only organic-sharing surface in the product. Money figures opt-in, off by default. | Tier 0 |
| **Challenges + exploration** | Discovery framed as play, never finances framed as competition. | Tier 0 |

---

## Deliberately NOT built

- **Dating.** Explicitly out of scope. Social matching is activity-based.
- **A housing marketplace.** Listing rentals invites unverifiable landlord
  claims and a moderation burden the product cannot yet carry.
- **Document storage.** Emergency info stores *what you have and where*, never
  scans of passports or visas — that needs security work this does not have.
- **A full LMS.** Study features stop at finding somewhere to work.
- **Live location sharing.** Matching uses campus and interests. Never GPS.
- **Points and leaderboards on money.** Making a broke student compete on
  spending is the one thing a budgeting product must never do.

---

## AI cost discipline

Every feature above was checked against "can this be done without a model?".
The answer was yes for all of Priority 1, 2 and 3 — brief, savings, free mode,
groceries, matching, settle-up and safety are arithmetic and SQL. Only the
planner and trip builder route to a model, both Tier 2, both cached per city
where the answer is not personal.
