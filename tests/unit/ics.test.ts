import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseIcs, parseIcsDate } from "../../src/domain/ics.ts";
import { classifyEvent } from "../../src/server/events/providers.ts";

/**
 * ============================================================================
 * ICALENDAR
 * ----------------------------------------------------------------------------
 * The parser behind the only way an external event can enter the product.
 *
 * The tests that matter most are the refusals. A calendar entry has no price,
 * so nothing may come out of here claiming to be free; and RRULE is read but
 * not implemented, so a recurring entry must be marked rather than silently
 * flattened into one date that looks like the only one.
 * ============================================================================
 */

const CALENDAR = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Universidad Complutense//Eventos//ES
BEGIN:VEVENT
UID:ucm-2026-09-15-welcome@ucm.es
DTSTART:20260915T190000Z
DTEND:20260915T210000Z
SUMMARY:Welcome week social for international students
DESCRIPTION:Come and meet people\\, no ticket needed.
LOCATION:Aula Magna\\, Facultad de Filosofía
URL:https://www.ucm.es/eventos/welcome-week
CATEGORIES:social,international
END:VEVENT
BEGIN:VEVENT
UID:ucm-football-weekly@ucm.es
DTSTART:20260916T170000Z
SUMMARY:Five-a-side football
RRULE:FREQ=WEEKLY;BYDAY=WE
LOCATION:Campo 2
END:VEVENT
BEGIN:VEVENT
UID:ucm-open-day@ucm.es
DTSTART;VALUE=DATE:20261001
SUMMARY:Open day
END:VEVENT
BEGIN:VEVENT
SUMMARY:Missing a start date
END:VEVENT
BEGIN:VEVENT
UID:no-summary@ucm.es
DTSTART:20260920T100000Z
END:VEVENT
END:VCALENDAR`;

describe("parseIcsDate", () => {
  it("reads the three forms a calendar actually uses", () => {
    assert.deepEqual(parseIcsDate("20260915T190000Z"), {
      iso: "2026-09-15T19:00:00.000Z",
      allDay: false,
    });
    assert.deepEqual(parseIcsDate("20260915T190000"), {
      iso: "2026-09-15T19:00:00.000Z",
      allDay: false,
    });
    assert.deepEqual(parseIcsDate("20261001"), {
      iso: "2026-10-01T00:00:00.000Z",
      allDay: true,
    });
  });

  it("returns null rather than a guess for anything else", () => {
    assert.equal(parseIcsDate("next Tuesday"), null);
    assert.equal(parseIcsDate("2026-09-15"), null);
    assert.equal(parseIcsDate(""), null);
  });
});

describe("parseIcs", () => {
  const events = parseIcs(CALENDAR);

  it("reads the events and drops the unusable ones", () => {
    /* Five VEVENTs: three complete, one with no start, one with no summary.
       The two incomplete ones are dropped rather than guessed at, and their
       presence must not lose the other three. */
    assert.equal(events.length, 3);
  });

  it("keeps every field the publisher gave", () => {
    const welcome = events.find((event) => event.uid?.startsWith("ucm-2026-09-15"));
    assert.ok(welcome);
    assert.equal(welcome.summary, "Welcome week social for international students");
    assert.equal(welcome.startsAt, "2026-09-15T19:00:00.000Z");
    assert.equal(welcome.endsAt, "2026-09-15T21:00:00.000Z");
    assert.equal(welcome.location, "Aula Magna, Facultad de Filosofía");
    assert.equal(welcome.url, "https://www.ucm.es/eventos/welcome-week");
    assert.deepEqual(welcome.categories, ["social", "international"]);
  });

  it("unescapes the text values", () => {
    const welcome = events.find((event) => event.uid?.startsWith("ucm-2026-09-15"));
    assert.equal(welcome?.description, "Come and meet people, no ticket needed.");
  });

  it("MARKS a recurring entry rather than pretending it is a one-off", () => {
    /* RRULE is read and not implemented. A weekly society meeting is ingested
       as its next occurrence, and the flag is how the sync reports that it
       could not represent the rest — the alternative, a half-implemented
       recurrence, puts a lecture on the wrong Tuesday for a term. */
    const football = events.find((event) => event.summary.includes("football"));
    assert.ok(football);
    assert.equal(football.recurring, true);

    const welcome = events.find((event) => event.summary.includes("Welcome"));
    assert.equal(welcome?.recurring, false);
  });

  it("knows a whole-day entry from a timed one", () => {
    const openDay = events.find((event) => event.summary === "Open day");
    assert.equal(openDay?.allDay, true);
  });

  it("unfolds a wrapped line rather than truncating it", () => {
    const folded = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:long@example.org",
      "DTSTART:20260915T190000Z",
      "SUMMARY:A title long enough that the publisher wrapped it across two li",
      " nes as the specification requires",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const [event] = parseIcs(folded);
    assert.ok(event);
    assert.match(event.summary, /two lines as the specification requires$/);
  });

  it("survives a document with no events", () => {
    assert.deepEqual(parseIcs("BEGIN:VCALENDAR\nEND:VCALENDAR"), []);
    assert.deepEqual(parseIcs(""), []);
  });

  it("never produces a price, because iCalendar has no price", () => {
    for (const event of events) {
      assert.ok(!("priceCents" in event), "a calendar entry cannot state a price");
    }
  });
});

describe("classifyEvent", () => {
  const entry = (summary: string, categories: string[] = []) => ({
    uid: null,
    summary,
    description: null,
    location: null,
    url: null,
    categories,
    startsAt: "2026-09-15T19:00:00.000Z",
    endsAt: null,
    allDay: false,
    recurring: false,
  });

  it("reads the obvious kinds out of the title", () => {
    assert.equal(classifyEvent(entry("Five-a-side football")), "sports");
    assert.equal(classifyEvent(entry("Jazz concert at the union")), "music");
    assert.equal(classifyEvent(entry("Hackathon weekend")), "tech");
    assert.equal(classifyEvent(entry("Photography exhibition")), "culture");
  });

  it("prefers the more specific reading", () => {
    /* "Career fair" is what a student is deciding about; that it happens at a
       university is not the useful half. */
    assert.equal(classifyEvent(entry("Autumn career fair")), "networking");
  });

  it("uses the calendar's own categories when the title says nothing", () => {
    assert.equal(classifyEvent(entry("Thursday at six", ["social"])), "social");
  });

  it("falls back to a description rather than a guess", () => {
    /* Nothing matched. "university" describes where the feed came from, which
       is true, rather than inventing a kind the entry does not support. */
    assert.equal(classifyEvent(entry("TBC")), "university");
  });
});
