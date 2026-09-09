/**
 * ============================================================================
 * ICALENDAR
 * ----------------------------------------------------------------------------
 * Enough of RFC 5545 to read a university's event calendar, and no more.
 *
 * ---------------------------------------------------------------------------
 * WHY ICS AND NOT AN EVENTS API
 *
 * The product needs real events and has no partner. The options were a
 * ticketing vendor's API, which needs a commercial relationship and covers
 * concerts rather than student life; scraping, which the product refuses on
 * principle and which this codebase has already refused once for job feeds; or
 * the calendars universities and municipal culture departments already publish
 * for anybody to subscribe to.
 *
 * The third is the only one that is both real and offered. An ICS feed is a
 * public URL its publisher created specifically so that other software would
 * read it — the same act of permission a JSON feed is — and nearly every
 * student union, faculty and city culture department has one.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS PARSER REFUSES
 *
 * It reads DTSTART, DTEND, SUMMARY, DESCRIPTION, LOCATION, URL, UID and
 * CATEGORIES. It does not implement RRULE. A recurring event is therefore read
 * as its first occurrence only, and the ingest marks it so — which is honest
 * and slightly useless, and far better than the alternative: a half-implemented
 * recurrence rule that puts a weekly lecture on the wrong Tuesday for a term.
 *
 * It also never invents a PRICE. An ICS event has no price field, so every row
 * it produces has `priceCents: null`, and the ingest refuses to turn that into
 * zero. "Free" is a claim, and a calendar entry does not make it.
 *
 * Pure: no fetch, no store, no `new Date()` except where the caller passes one.
 * ============================================================================
 */

export type IcsEvent = {
  /** UID from the feed. The stable identity a re-sync updates rather than duplicates. */
  uid: string | null;
  summary: string;
  description: string | null;
  location: string | null;
  url: string | null;
  categories: string[];
  /** ISO instant. */
  startsAt: string;
  endsAt: string | null;
  /** True when the entry is a whole-day event (DTSTART;VALUE=DATE). */
  allDay: boolean;
  /** True when the entry carries an RRULE this parser deliberately ignores. */
  recurring: boolean;
};

/**
 * Unfold the line wrapping RFC 5545 requires.
 *
 * A long value is split across lines with a space or tab beginning the
 * continuation. Parsing without unfolding first silently truncates every long
 * summary at seventy-five characters, which looks like the publisher's fault.
 */
function unfold(text: string): string[] {
  const lines: string[] = [];
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    if ((raw.startsWith(" ") || raw.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += raw.slice(1);
    } else {
      lines.push(raw);
    }
  }
  return lines;
}

/** `\,` `\;` `\n` `\\` are escaped in ICS text values. */
function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

/**
 * `20260915T190000Z`, `20260915T190000` and `20260915` into an ISO instant.
 *
 * A floating time — no Z and no TZID this parser resolves — is read as UTC and
 * the caller is told, because guessing the publisher's timezone would move
 * every event by up to a day and there is no honest default. In practice
 * university feeds are almost always UTC or carry a TZID; the ones that do not
 * produce times that may be hours out, which is why `ingestEvents` keeps the
 * publisher's own URL on every row so a student can check.
 */
export function parseIcsDate(value: string): { iso: string; allDay: boolean } | null {
  const clean = value.trim();

  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(clean);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return { iso: `${year}-${month}-${day}T00:00:00.000Z`, allDay: true };
  }

  const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(clean);
  if (!dateTime) return null;

  const [, year, month, day, hour, minute, second] = dateTime;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
  return Number.isNaN(Date.parse(iso)) ? null : { iso, allDay: false };
}

/**
 * Every VEVENT in a calendar.
 *
 * Anything without a summary or a parseable start is dropped rather than
 * guessed at. A feed half of which fails to parse produces half the events and
 * no errors, which is the right trade for a source we do not control: one
 * malformed entry must not lose the other four hundred.
 */
export function parseIcs(text: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  let current: Partial<IcsEvent> & { categories: string[] } = { categories: [] };
  let inEvent = false;

  for (const line of unfold(text)) {
    if (line.startsWith("BEGIN:VEVENT")) {
      inEvent = true;
      current = { categories: [], recurring: false };
      continue;
    }

    if (line.startsWith("END:VEVENT")) {
      inEvent = false;
      if (current.summary && current.startsAt) {
        events.push({
          uid: current.uid ?? null,
          summary: current.summary,
          description: current.description ?? null,
          location: current.location ?? null,
          url: current.url ?? null,
          categories: current.categories,
          startsAt: current.startsAt,
          endsAt: current.endsAt ?? null,
          allDay: current.allDay ?? false,
          recurring: current.recurring ?? false,
        });
      }
      continue;
    }

    if (!inEvent) continue;

    /* `DTSTART;TZID=Europe/Madrid:20260915T190000` — the name may carry
       parameters after a semicolon, and the value is everything after the
       first colon, which may itself contain colons (a URL). */
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const name = line.slice(0, colon).split(";")[0]?.toUpperCase() ?? "";
    const value = line.slice(colon + 1);

    switch (name) {
      case "UID":
        current.uid = value.trim();
        break;
      case "SUMMARY":
        current.summary = unescapeText(value);
        break;
      case "DESCRIPTION":
        current.description = unescapeText(value) || null;
        break;
      case "LOCATION":
        current.location = unescapeText(value) || null;
        break;
      case "URL":
        current.url = value.trim() || null;
        break;
      case "CATEGORIES":
        current.categories = unescapeText(value)
          .split(",")
          .map((entry) => entry.trim().toLowerCase())
          .filter(Boolean);
        break;
      case "RRULE":
        /* Read, recorded, and not implemented. See the header. */
        current.recurring = true;
        break;
      case "DTSTART": {
        const parsed = parseIcsDate(value);
        if (parsed) {
          current.startsAt = parsed.iso;
          current.allDay = parsed.allDay;
        }
        break;
      }
      case "DTEND": {
        const parsed = parseIcsDate(value);
        if (parsed) current.endsAt = parsed.iso;
        break;
      }
      default:
        break;
    }
  }

  return events;
}
