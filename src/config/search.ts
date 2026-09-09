/**
 * ============================================================================
 * SEARCH DESTINATIONS
 * ----------------------------------------------------------------------------
 * Every screen a student can reach by typing its name, and the words they
 * would actually type to get there.
 *
 * NOT THE SAME LIST AS `destinations.ts`. That one is the "more" grid on the
 * You page: nine cards, chosen, with an icon each. This one is the search
 * index -- everything, including the settings screens nobody wants a card
 * for, with no icons and with keywords instead. They are different jobs and a
 * single list would do neither well: the You page would grow to forty cards,
 * or the palette would only find nine things.
 *
 * KEYWORDS ARE THE POINT. A student looking for the residency-card checklist
 * types "NIE", "empadronamiento" or "registration", not "Arrival". They type
 * "rent" for Budget, "flat" for Marketplace, "SIM" for Starter pack. Every
 * entry below is keyed on what someone would say out loud, including the
 * Spanish word when that is the word on the form they are holding.
 *
 * It is a plain module with no `"use client"` and no icon imports, so the
 * palette can filter it in the browser with no round trip and a server
 * component could render it too.
 * ============================================================================
 */

/** The heading a destination is filed under in the palette. */
export type SearchGroup = "Today" | "City" | "Money" | "People" | "You";

export type SearchDestination = {
  href: string;
  label: string;
  /** The one line under the label. Says what it does, not what it is called. */
  hint: string;
  group: SearchGroup;
  /**
   * Extra words that should find this row. The label is always searched, so
   * these are only the things a student would say that the label does not.
   */
  keywords: readonly string[];
};

export const SEARCH_DESTINATIONS: readonly SearchDestination[] = [
  /* ---- Today ------------------------------------------------------------ */
  {
    href: "/home",
    label: "Home",
    hint: "What today looks like, and what it costs",
    group: "Today",
    keywords: ["dashboard", "start", "overview"],
  },
  {
    href: "/lifeops",
    label: "Today",
    hint: "Everything with a date on it, in one timeline",
    group: "Today",
    keywords: ["timeline", "deadlines", "todo", "tasks", "admin", "due", "calendar"],
  },
  {
    href: "/missions",
    label: "Missions",
    hint: "Small things that make the city easier, one at a time",
    group: "Today",
    keywords: ["challenge", "quest", "streak", "progress"],
  },
  {
    href: "/arrival",
    label: "Arrival",
    hint: "The first-weeks checklist: registration, bank, card, doctor",
    group: "Today",
    keywords: [
      "nie",
      "tie",
      "empadronamiento",
      "padron",
      "residency",
      "registration",
      "bank account",
      "moving in",
      "first week",
      "setup",
    ],
  },
  {
    href: "/leaving",
    label: "Leaving",
    hint: "Closing accounts, deposits, and what to sell",
    group: "Today",
    keywords: ["moving out", "deposit", "cancel", "end of year", "going home"],
  },
  {
    href: "/starter-pack",
    label: "Starter pack",
    hint: "SIM, transport card, bank: the four things to sort first",
    group: "Today",
    keywords: ["sim", "phone", "metro card", "transport card", "abono", "bank"],
  },

  /* ---- City ------------------------------------------------------------- */
  {
    href: "/discover",
    label: "Explore",
    hint: "Real places near you, with what they cost",
    group: "City",
    keywords: ["places", "map", "food", "eat", "cheap", "supermarket", "pharmacy", "nearby", "discover"],
  },
  {
    href: "/events",
    label: "Events",
    hint: "What is on, with the free ones first",
    group: "City",
    keywords: ["whats on", "tonight", "free", "gigs", "meetup"],
  },
  {
    href: "/neighbourhoods",
    label: "Neighbourhoods",
    hint: "Where to live, and what it actually costs there",
    group: "City",
    keywords: ["areas", "barrio", "district", "where to live", "rent"],
  },
  {
    href: "/guides",
    label: "Guides",
    hint: "How things work here, written down",
    group: "City",
    keywords: ["how to", "help", "explain", "handbook"],
  },
  {
    href: "/speak",
    label: "Speak",
    hint: "The sentence you need, for the situation you are in",
    group: "City",
    keywords: ["language", "spanish", "phrase", "translate", "say", "words"],
  },
  {
    href: "/plans",
    label: "Plans",
    hint: "Days out, costed before you go",
    group: "City",
    keywords: ["itinerary", "saturday", "day out", "trip"],
  },
  {
    href: "/saved",
    label: "Saved",
    hint: "Everything you kept",
    group: "City",
    keywords: ["bookmarks", "favourites", "lists", "kept"],
  },

  /* ---- Money ------------------------------------------------------------ */
  {
    href: "/budget",
    label: "Budget",
    hint: "What is safe to spend, today and this week",
    group: "Money",
    keywords: ["money", "spend", "spending", "rent", "bills", "balance", "left"],
  },
  {
    href: "/budget/afford",
    label: "Can I afford it",
    hint: "Check one purchase against the rest of the month",
    group: "Money",
    keywords: ["afford", "should i buy", "cost", "check"],
  },
  {
    href: "/budget/survival",
    label: "Survival mode",
    hint: "When the month is longer than the money",
    group: "Money",
    keywords: ["broke", "emergency", "skint", "no money", "help"],
  },
  {
    href: "/budget/shared",
    label: "Shared costs",
    hint: "Who owes what, without the spreadsheet",
    group: "Money",
    keywords: ["split", "flatmates", "owe", "settle", "housemates"],
  },
  {
    href: "/budget/travel",
    label: "Travel budget",
    hint: "What a trip does to the month",
    group: "Money",
    keywords: ["flights", "holiday", "weekend away"],
  },
  {
    href: "/work",
    label: "Work",
    hint: "Jobs that fit a student visa and a timetable",
    group: "Money",
    keywords: ["job", "jobs", "part time", "earn", "income", "hiring", "shifts"],
  },
  {
    href: "/work/rights",
    label: "Your rights at work",
    hint: "Hours, pay, and what a visa allows",
    group: "Money",
    keywords: ["visa hours", "legal", "employment", "contract", "minimum wage"],
  },
  {
    href: "/work/applications",
    label: "Applications",
    hint: "What you applied for, and what came back",
    group: "Money",
    keywords: ["applied", "cv", "resume", "status"],
  },
  {
    href: "/marketplace",
    label: "Marketplace",
    hint: "Second-hand from students leaving",
    group: "Money",
    keywords: ["buy", "sell", "furniture", "bike", "second hand", "used"],
  },
  {
    href: "/exchange",
    label: "Exchange",
    hint: "Pass things on to whoever arrives next",
    group: "Money",
    keywords: ["give away", "free stuff", "handover", "swap"],
  },
  {
    href: "/upgrade",
    label: "Plans and pricing",
    hint: "What the paid tiers add",
    group: "Money",
    keywords: ["pro", "premium", "subscribe", "billing", "price", "upgrade"],
  },

  /* ---- People ----------------------------------------------------------- */
  {
    href: "/pulse",
    label: "Pulse",
    hint: "What students here are saying today",
    group: "People",
    keywords: ["feed", "posts", "community", "board"],
  },
  {
    href: "/pulse/chat",
    label: "Messages",
    hint: "Your conversations",
    group: "People",
    keywords: ["dm", "chat", "inbox", "talk"],
  },
  {
    href: "/anyone-down",
    label: "Anyone down",
    hint: "Something to do tonight, with people",
    group: "People",
    keywords: ["meet", "hang out", "lonely", "friends tonight"],
  },
  {
    href: "/ask/questions",
    label: "Ask students",
    hint: "Questions answered by people who live here",
    group: "People",
    keywords: ["question", "advice", "forum", "answers"],
  },
  {
    href: "/you/friends",
    label: "Friends",
    hint: "People you have met",
    group: "People",
    keywords: ["contacts", "people", "added"],
  },

  /* ---- You -------------------------------------------------------------- */
  {
    href: "/you",
    label: "You",
    hint: "Your profile and everything under it",
    group: "You",
    keywords: ["account", "me"],
  },
  {
    href: "/you/profile",
    label: "Edit profile",
    hint: "Name, photo, course, what you are into",
    group: "You",
    keywords: ["name", "avatar", "bio", "course", "edit"],
  },
  {
    href: "/you/city",
    label: "Change city",
    hint: "Move the whole product to another city",
    group: "You",
    keywords: ["city", "move", "switch", "relocate", "country"],
  },
  {
    href: "/you/privacy",
    label: "Privacy",
    hint: "Who can see what, and how precisely",
    group: "You",
    keywords: ["visible", "location", "hide", "who can see", "blocked"],
  },
  {
    href: "/you/notifications",
    label: "Notification settings",
    hint: "What is worth interrupting you for",
    group: "You",
    keywords: ["push", "email", "quiet"],
  },
  {
    href: "/you/data",
    label: "Your data",
    hint: "Export it, reset it, or delete the account",
    group: "You",
    keywords: ["export", "download", "gdpr", "delete account", "erase"],
  },
  {
    href: "/notifications",
    label: "Notifications",
    hint: "What happened while you were away",
    group: "You",
    keywords: ["alerts", "unread", "activity"],
  },
];

/** The order groups appear in the palette. Not alphabetical: by urgency. */
export const SEARCH_GROUPS: readonly SearchGroup[] = ["Today", "City", "Money", "People", "You"];
