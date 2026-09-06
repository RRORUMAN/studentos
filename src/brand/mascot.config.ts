/**
 * ============================================================================
 * MASCOT — single source of truth.
 * ----------------------------------------------------------------------------
 * The character is a black French Bulldog in black rectangular glasses: the
 * student who already figured the city out. Knows the cheap places, knows what
 * is on tonight, will tell you when a thing is not worth the money.
 *
 * The canonical reference is a soft-rendered portrait: black coat, large
 * upright bat ears, big warm brown eyes, matte black rectangular frames, a
 * calm, slightly amused face. Every state, accessory and asset in this file is
 * a reading of that one character. NOTHING is a different dog.
 *
 * NOTHING in the codebase hardcodes the mascot's name or an asset path. Both
 * are read from here.
 * ============================================================================
 */

export const mascot = {
  /** Working name. Change this one value to rename the character everywhere. */
  name: "Baxter",
  slug: "baxter",
  species: "French Bulldog",
  /**
   * The one physical detail that is not negotiable. Matte black rectangular
   * frames: the fastest read in the drawing, the thing that identifies him at
   * 16px, and why he looks like someone who has already read the thing you
   * are about to ask about.
   */
  signature: "black rectangular glasses",
  premise: "The student who's already figured the city out.",
  traits: ["smart", "friendly", "slightly cheeky", "helpful", "social", "budget-aware", "adventurous", "curious", "confident"],
  voice: {
    do: [
      "Six words or fewer, most of the time.",
      "Say the number, not the feeling.",
      "Dry, not zany. He is amused, not excited.",
      "Never more than one line per screen.",
    ],
    dont: [
      "No exclamation marks unless something genuinely landed.",
      "Never scold about money. Offer the cheaper option instead.",
      "No 'Woof', no puns on dog, no barking.",
      "Never the voice of the company. He is a student, not support.",
    ],
  },
} as const;

/* -------------------------------------------------------------------------- */
/* States                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The expression set. One face, fifteen readings of it. Silhouette,
 * proportions, coat and frames never change between states — only eyes, brows,
 * mouth and a few degrees of tilt — which is what keeps him one character
 * rather than fifteen drawings.
 */
export const mascotStates = [
  "neutral",
  "thinking",
  "happy",
  "excited",
  "celebrating",
  "budget",
  "concerned",
  "explorer",
  "social",
  "arrival",
  "survival",
  "error",
  "empty",
  "travel",
  "focus",
] as const;

export type MascotState = (typeof mascotStates)[number];

/**
 * Names the previous drawing used. Accepted everywhere a state is, and mapped
 * onto the current set, so old call sites keep working while they are moved.
 */
export const legacyMascotStates = {
  warning: "concerned",
  confused: "empty",
  determined: "survival",
} as const satisfies Record<string, MascotState>;

export type LegacyMascotState = keyof typeof legacyMascotStates;

export function resolveMascotState(state: MascotState | LegacyMascotState): MascotState {
  return state in legacyMascotStates ? legacyMascotStates[state as LegacyMascotState] : (state as MascotState);
}

/** Where each state is allowed to appear, and what it must never be used for. */
export const mascotStateGuide: Record<MascotState, { label: string; use: string; avoid: string }> = {
  neutral: { label: "Neutral", use: "Resting. Nav, the brief, anywhere he is present but not reacting.", avoid: "Not a placeholder for a state you have not built yet." },
  thinking: { label: "Thinking", use: "AI is working. Retrieval, plan generation, any pending answer.", avoid: "Never for a slow network. That is a spinner's job." },
  happy: { label: "Happy", use: "A good recommendation landed. The answer after Thinking.", avoid: "Not on every card. It marks the answer, not the list." },
  excited: { label: "Excited", use: "Events and social energy: a free thing, a plan filling up.", avoid: "Excitement that fires constantly reads as noise." },
  celebrating: { label: "Celebrating", use: "Onboarding complete, a week under budget, joined a plan.", avoid: "Rare by design. A handful of uses in the whole product." },
  budget: { label: "Budget smart", use: "Money insights, the budget coach, Can I afford this.", avoid: "Never gloating about a saving. He states the number." },
  concerned: { label: "Concerned", use: "Budget pressure. Spending ahead of pace, an expensive plan.", avoid: "Never disapproving. Concerned, then immediately useful." },
  explorer: { label: "Explorer", use: "Maps and Discover. Scanning the city, pointing at somewhere good.", avoid: "Not for search results in a list." },
  social: { label: "Social", use: "Pulse, Anyone Down?, groups forming, people joining.", avoid: "Not inside individual posts or messages." },
  arrival: { label: "Arrival", use: "Moving abroad. Arrival Mode, the first week, the move plan.", avoid: "Not once the student is established." },
  survival: { label: "Survival", use: "Survival Mode. A hard number and a deadline, taken seriously.", avoid: "Never for anything trivial. This is the 'right, plan' face." },
  error: { label: "Error", use: "Something failed to load. Friendly, then a retry.", avoid: "Never jokes about a serious error, never hides one." },
  empty: { label: "Empty", use: "Nothing found, nothing saved yet, nobody posted.", avoid: "Never for a user mistake. He is puzzled, the student is not." },
  travel: { label: "Travel", use: "Trips, another city, multi-city planning.", avoid: "Not for local travel inside the city." },
  focus: { label: "Focus", use: "Study spots, exam mode, campus.", avoid: "Not for general 'work' copy." },
};

/* -------------------------------------------------------------------------- */
/* Microcopy                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The sanctioned line library. Components pick from here rather than writing
 * their own. Every line is six words or fewer unless it carries a number.
 */
export const mascotLines = {
  thinking: ["Reading the city.", "Give me a second.", "Checking what students said."],
  found: ["Found something.", "Found something better.", "That one's free."],
  budgetSafe: ["You're good.", "Tonight's plan fits.", "Fits the number."],
  budgetTight: ["Maybe take the free option tonight.", "Tight week. Still doable.", "Try this instead."],
  afford: ["Yep — but here's the cheaper option.", "Fits. Barely.", "Not tonight. Here's what does."],
  social: ["Three people are going.", "Someone's two people short.", "This one fills up."],
  empty: ["Nothing here yet.", "Nothing great here yet.", "Let's find something worth saving."],
  arrival: ["First week? Start here.", "Let's make this city yours.", "First week, in order."],
  survival: ["Alright. Game plan.", "We can work with that."],
  explore: ["Better option nearby.", "Good value.", "Worth the walk."],
  celebrate: ["Under budget. Nice.", "Done. Properly.", "That's a week."],
  error: ["Couldn't load that.", "Try again."],
  travel: ["New city. Same rules.", "Plan it before you land."],
  focus: ["Quiet, cheap, has plugs.", "Library's full. Try this."],
} as const;

export type MascotLineSet = keyof typeof mascotLines;

/** Deterministic line pick, so server and client agree and nobody hydrates a mismatch. */
export function mascotLine(set: MascotLineSet, index = 0): string {
  const lines = mascotLines[set];
  return lines[index % lines.length];
}

/* -------------------------------------------------------------------------- */
/* Accessories                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Costume changes are rationed: one item, in one place, for one reason. He
 * never wears more than one, and never one that is not in this list.
 */
export const mascotAccessories = [
  "none",
  "backpack",
  "calculator",
  "luggage-tag",
  "speech-bubble",
  "notebook",
  "map-pin",
  "collar",
  "cap",
] as const;

export type MascotAccessory = (typeof mascotAccessories)[number];

/** Which accessory a state reaches for by default, when a caller asks for one. */
export const mascotAccessoryFor: Partial<Record<MascotState, MascotAccessory>> = {
  arrival: "backpack",
  budget: "calculator",
  travel: "luggage-tag",
  social: "speech-bubble",
  focus: "notebook",
  explorer: "map-pin",
};

/* -------------------------------------------------------------------------- */
/* Motion                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Motion tokens. All CSS, all transform-only; every one collapses under
 * prefers-reduced-motion to a composed static character.
 */
export const mascotAnimation = {
  breathe: { durationMs: 7_000, travelPx: 3 },
  blink: { periodMs: 6_500, durationMs: 120 },
  earTwitch: { periodMs: 9_000, degrees: 7 },
  pop: { durationMs: 600 },
  think: { periodMs: 2_400, degrees: 3 },
  nod: { durationMs: 900 },
  glassesAdjust: { durationMs: 700 },
} as const;

/* -------------------------------------------------------------------------- */
/* Assets                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Rendered assets, when they exist.
 *
 * The canonical reference is a rendered portrait, and rendered variants of it
 * are the ideal way to show each state. This project cannot generate images,
 * so it does the honest thing: `MascotArt` renders the vector character by
 * default, and switches to a rendered asset per state ONLY when a file is
 * declared here. Nothing in the UI pretends an asset exists.
 *
 * To add renders: drop `public/brand/mascot/<state>.webp` (square, transparent
 * or on the warm paper ground, at least 512px), run `pnpm mascot:manifest`, and
 * the entries below are regenerated from what is on disk.
 *
 * Every render must preserve: coat, eyes, glasses, head and ear shape,
 * proportions, lighting. A variant that changes the character is rejected —
 * consistency is the brand asset, not any single image.
 */
export const mascotAssetDir = "/brand/mascot";

export type MascotAssetManifest = Partial<Record<MascotState, { file: string; width: number; height: number }>>;

/** Regenerated by `scripts/mascot-manifest.mjs`. Empty means: vector only. */
export const mascotAssets: MascotAssetManifest = {};

export function mascotAssetFor(state: MascotState): { src: string; width: number; height: number } | null {
  const entry = mascotAssets[state] ?? mascotAssets.neutral;
  return entry ? { src: `${mascotAssetDir}/${entry.file}`, width: entry.width, height: entry.height } : null;
}

/* -------------------------------------------------------------------------- */
/* Accessible naming                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Builds an accessible name for the rare placement where the mascot carries
 * meaning on his own. Everywhere else he is decorative and gets no name: his
 * expression restates something the copy beside him already says.
 */
export function mascotAlt(state: MascotState | LegacyMascotState, productName: string): string {
  const resolved = resolveMascotState(state);
  return `${mascot.name}, the ${productName} ${mascot.species}, ${mascotStateGuide[resolved].label.toLowerCase()}`;
}
