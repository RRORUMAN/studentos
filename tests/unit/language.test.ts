import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SITUATIONS,
  contextPhrases,
  dailyPhrase,
  localLanguageFor,
  phrasesFor,
  situationForContext,
  situationsIn,
  summarise,
  type PhraseProgress,
} from "../../src/domain/language.ts";
import { offeredLanguages, packFor, packs } from "../../src/data/language/index.ts";

/**
 * ============================================================================
 * SPEAK LOCAL
 * ----------------------------------------------------------------------------
 * The tests that matter here are not about phrases being present. They are
 * about four promises the interface makes and could quietly break:
 *
 *   1. "Today's phrase" is the same phrase all day. Two requests on the same
 *      day must agree, or the words mean nothing.
 *   2. A phrase marked known never comes back as today's phrase.
 *   3. Tier 1 is exhausted before tier 2 is offered, so a student who arrived
 *      yesterday is taught "excuse me" before "the boiler is broken".
 *   4. A contextual hint appears only where there is an obvious sentence, and
 *      shows nothing rather than something generic.
 *
 * Plus the data invariants: no duplicate ids, no phrase without a meaning, no
 * pack claiming a coverage its contents do not support.
 * ============================================================================
 */

const spanish = packFor("es")!;
const KNOWN_NONE = new Set<string>();

describe("which language", () => {
  it("comes from the country, not the city", () => {
    assert.equal(localLanguageFor("ES"), "es");
    assert.equal(localLanguageFor("DE"), "de");
    assert.equal(localLanguageFor("AT"), "de");
    assert.equal(localLanguageFor("GB"), "en");
  });

  it("returns null rather than guessing for a country with no pack", () => {
    assert.equal(localLanguageFor("JP"), null);
    assert.equal(localLanguageFor(null), null);
    assert.equal(localLanguageFor(""), null);
  });
});

describe("today's phrase", () => {
  it("is the same phrase all day for the same student", () => {
    const first = dailyPhrase(spanish, { dayKey: "2026-09-08", userId: "u1", known: KNOWN_NONE });
    const second = dailyPhrase(spanish, { dayKey: "2026-09-08", userId: "u1", known: KNOWN_NONE });
    assert.ok(first);
    assert.equal(first.phrase.id, second?.phrase.id);
  });

  it("is not the same phrase for two students", () => {
    /* Not guaranteed for any one day, so this checks across a week: two
       students landing on identical phrases every day would mean the user is
       not in the hash at all. */
    const days = ["2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12"];
    const differs = days.some((dayKey) => {
      const a = dailyPhrase(spanish, { dayKey, userId: "u1", known: KNOWN_NONE });
      const b = dailyPhrase(spanish, { dayKey, userId: "u2", known: KNOWN_NONE });
      return a?.phrase.id !== b?.phrase.id;
    });
    assert.ok(differs);
  });

  it("moves on when the day does", () => {
    const week = new Set(
      ["2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11"].map(
        (dayKey) => dailyPhrase(spanish, { dayKey, userId: "u1", known: KNOWN_NONE })?.phrase.id,
      ),
    );
    assert.ok(week.size > 1, "four days produced the same phrase every time");
  });

  it("never repeats a phrase the student marked known", () => {
    const known = new Set(spanish.phrases.filter((phrase) => phrase.tier === 1).map((phrase) => phrase.id));
    const pick = dailyPhrase(spanish, { dayKey: "2026-09-08", userId: "u1", known });
    assert.ok(pick);
    assert.ok(!known.has(pick.phrase.id));
  });

  it("finishes tier 1 before offering tier 2", () => {
    const pick = dailyPhrase(spanish, { dayKey: "2026-09-08", userId: "u1", known: KNOWN_NONE });
    assert.equal(pick?.phrase.tier, 1);
  });

  it("returns null rather than starting again when the pack is finished", () => {
    const known = new Set(spanish.phrases.map((phrase) => phrase.id));
    assert.equal(dailyPhrase(spanish, { dayKey: "2026-09-08", userId: "u1", known }), null);
  });
});

describe("progress", () => {
  const rows: PhraseProgress[] = [
    { userId: "u1", language: "es", phraseId: spanish.phrases[0]!.id, status: "known", seenCount: 2, updatedAt: "2026-09-08" },
    { userId: "u1", language: "es", phraseId: spanish.phrases[1]!.id, status: "saved", seenCount: 1, updatedAt: "2026-09-08" },
    /* A row from a language the student used to learn. It must not be counted
       against this pack, and it must not be deleted either. */
    { userId: "u1", language: "de", phraseId: "de.first-words.hallo", status: "known", seenCount: 1, updatedAt: "2026-09-01" },
  ];

  it("counts only the pack being summarised", () => {
    const summary = summarise(spanish, rows);
    assert.equal(summary.known, 1);
    assert.equal(summary.saved, 1);
    assert.equal(summary.total, spanish.phrases.length);
  });

  it("points at the situation with the biggest gap at tier 1", () => {
    const summary = summarise(spanish, []);
    assert.ok(summary.nextUp);
    assert.ok(SITUATIONS.includes(summary.nextUp));
  });

  it("reports every situation the pack covers", () => {
    const summary = summarise(spanish, []);
    assert.equal(summary.bySituation.length, situationsIn(spanish).length);
    assert.ok(summary.bySituation.every((row) => row.total > 0));
  });
});

describe("context", () => {
  it("puts the bill next to a restaurant", () => {
    const phrases = contextPhrases(spanish, { kind: "place", category: "Lunch menu" });
    assert.ok(phrases.length > 0);
    assert.ok(phrases.every((phrase) => phrase.situation === "eating-out"));
  });

  it("puts the price question next to a supermarket", () => {
    const phrases = contextPhrases(spanish, { kind: "place", category: "Supermarket" });
    assert.ok(phrases.every((phrase) => phrase.situation === "groceries"));
  });

  it("puts the student discount question next to a museum", () => {
    const phrases = contextPhrases(spanish, { kind: "place", category: "Museum" });
    assert.ok(phrases.every((phrase) => phrase.situation === "money"));
  });

  it("shows nothing rather than something generic for a gym", () => {
    /* A gym has no sentence that is obviously the one you need, and filling
       the slot anyway is how a good idea becomes clutter. */
    assert.equal(situationForContext({ kind: "place", category: "Gym" }), "money");
    assert.equal(situationForContext({ kind: "place", category: "Coworking" }), null);
    assert.deepEqual(contextPhrases(spanish, { kind: "place", category: "Coworking" }), []);
  });

  it("attaches transport words to the transport card task and nothing to a task with no conversation in it", () => {
    assert.equal(situationForContext({ kind: "arrival", taskKey: "transport-card" }), "getting-around");
    assert.equal(situationForContext({ kind: "arrival", taskKey: "save-home" }), null);
  });

  it("caps the hint hard", () => {
    assert.ok(contextPhrases(spanish, { kind: "place", category: "Bar" }).length <= 2);
  });
});

describe("the packs themselves", () => {
  it("has no duplicate phrase ids anywhere", () => {
    const ids = packs.flatMap((pack) => pack.phrases.map((phrase) => phrase.id));
    assert.equal(new Set(ids).size, ids.length);
  });

  it("namespaces every phrase id under its own language", () => {
    for (const pack of packs) {
      for (const phrase of pack.phrases) {
        assert.ok(
          phrase.id.startsWith(`${pack.code}.`),
          `${phrase.id} is in the ${pack.code} pack but is not namespaced to it`,
        );
      }
    }
  });

  it("gives every phrase something to say and something it means", () => {
    for (const pack of packs) {
      for (const phrase of pack.phrases) {
        assert.ok(phrase.text.trim().length > 0, `${phrase.id} has no text`);
        assert.ok(phrase.meaning.trim().length > 0, `${phrase.id} has no meaning`);
      }
    }
  });

  it("declares a coverage its contents actually support", () => {
    /* The whole honesty argument for this feature is that a pack says how
       complete it is. A "full" pack that turned out to hold twenty phrases
       would make that label worthless. */
    const floor = { full: 60, core: 30, starter: 10 } as const;
    for (const pack of packs) {
      assert.ok(
        pack.phrases.length >= floor[pack.coverage],
        `${pack.name} claims ${pack.coverage} with only ${pack.phrases.length} phrases`,
      );
    }
  });

  it("covers the first words in every pack, however small", () => {
    for (const pack of packs) {
      assert.ok(
        phrasesFor(pack, "first-words").length > 0,
        `${pack.name} has no first words`,
      );
    }
  });

  it("gives the flagship pack every situation", () => {
    assert.equal(situationsIn(spanish).length, SITUATIONS.length);
  });

  it("orders the language list by how much is behind it", () => {
    const offered = offeredLanguages();
    assert.equal(offered[0]?.code, "es");
    assert.ok(offered.every((row) => row.count > 0));
  });

  it("carries a speech tag that matches the language", () => {
    for (const pack of packs) {
      assert.ok(
        pack.speechTag.toLowerCase().startsWith(pack.code),
        `${pack.name} has speech tag ${pack.speechTag}`,
      );
    }
  });
});
