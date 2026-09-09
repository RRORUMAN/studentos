import {
  type DataConfidence,
  type PlaceLayer,
  type PlaceProviderId,
  type ValueBand,
  placeGroupLabel,
  placeCategories,
} from "@/domain/places";

/**
 * ============================================================================
 * PLACE PRESENTATION
 * ----------------------------------------------------------------------------
 * Labels and rails. In `src/config` rather than beside the data because both a
 * client component and a `"use server"` action need them, and a `"use server"`
 * module may only export async functions.
 *
 * THIS FILE REPLACED `src/data/places.ts`, which held twenty-five invented
 * places alongside the labels. The labels survived; the places did not. They
 * now come from `src/server/places`, which asks a provider.
 * ============================================================================
 */

export const placeLayers: readonly {
  key: PlaceLayer;
  label: string;
  accent: "signal" | "pulse" | "flow" | "mint" | "amber";
}[] = [
  { key: "for-you", label: "For You", accent: "signal" },
  { key: "cheap-food", label: "Cheap Food", accent: "amber" },
  { key: "groceries", label: "Groceries", accent: "mint" },
  { key: "free", label: "Free", accent: "mint" },
  { key: "deals", label: "Deals", accent: "amber" },
  { key: "study", label: "Study", accent: "flow" },
  { key: "nightlife", label: "Nightlife", accent: "pulse" },
  { key: "fitness", label: "Fitness", accent: "flow" },
  { key: "culture", label: "Culture", accent: "pulse" },
  { key: "everyday", label: "Everyday", accent: "flow" },
] as const;

/**
 * Explore's filter rail, grouped.
 *
 * Ten chips in a row is a wall; two rows of five is a wall lying down. The
 * groups let the interface show four and put the rest behind "More", which is
 * the difference between a filter bar somebody uses and one they scroll past.
 */
export const layerGroups: readonly { label: string; layers: readonly PlaceLayer[] }[] = [
  { label: "Everyday", layers: ["for-you", "groceries", "cheap-food", "free"] },
  { label: "Going out", layers: ["nightlife", "culture", "deals"] },
  { label: "Getting things done", layers: ["study", "fitness", "everyday"] },
];

/** Where a place came from, said in the interface, next to the place. */
export const providerLabel: Record<PlaceProviderId, string> = {
  osm: "OpenStreetMap",
  google: "Google Maps",
  students: "Students",
};

/**
 * How sure we are, in words rather than a number.
 *
 * The bands come from what the provider actually published about a row — a
 * shop with opening hours, a website and an address has somebody maintaining
 * it; a bare name and a point may be five years old.
 */
export const confidenceLabel: Record<DataConfidence, string> = {
  verified: "Verified",
  recent: "Recently updated",
  "community-reported": "Reported by students",
  limited: "Limited detail",
  unknown: "Unknown",
};

export const confidenceTone: Record<DataConfidence, "mint" | "flow" | "amber" | "muted"> = {
  verified: "mint",
  recent: "flow",
  "community-reported": "flow",
  limited: "amber",
  unknown: "muted",
};

/**
 * Value bands, as a student reads them.
 *
 * "Not enough student data" is the important one and it is deliberately a full
 * sentence rather than a dash: a blank space reads as an oversight, and the
 * absence of student signal in a new city is a fact about the city, not a bug.
 */
export const valueLabel: Record<ValueBand, string> = {
  strong: "Strong student value",
  good: "Good student value",
  mixed: "Mixed reviews",
  insufficient: "Not enough student data",
};

export const valueTone: Record<ValueBand, "signal" | "mint" | "amber" | "muted"> = {
  strong: "signal",
  good: "mint",
  mixed: "amber",
  insufficient: "muted",
};

/** Category chips for the "what are you looking for" sheet, grouped. */
export const categoryGroups = Object.entries(
  placeCategories.reduce<Record<string, { key: string; label: string }[]>>((groups, meta) => {
    const label = placeGroupLabel[meta.group];
    (groups[label] ??= []).push({ key: meta.key, label: meta.label });
    return groups;
  }, {}),
).map(([label, categories]) => ({ label, categories }));
