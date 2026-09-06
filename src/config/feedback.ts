/**
 * Recommendation feedback controls — "More like this", "Not for me", and the
 * rest. Shared by the client menu and the server action; lives here rather
 * than beside the action because a "use server" module may only export async
 * functions.
 */
export type FeedbackKind = "more" | "not-for-me" | "too-expensive" | "too-far" | "been" | "wrong";

export const feedbackMeta: Record<FeedbackKind, string> = {
  more: "More like this",
  "not-for-me": "Not for me",
  "too-expensive": "Too expensive",
  "too-far": "Too far",
  been: "Already been",
  wrong: "Wrong info",
};

export const feedbackOrder: readonly FeedbackKind[] = ["more", "not-for-me", "too-expensive", "too-far", "been", "wrong"];
