import { brand } from "@/brand/brand.config";

/**
 * ============================================================================
 * THE ONBOARDING DRAFT
 * ----------------------------------------------------------------------------
 * One `sessionStorage` entry that two screens share.
 *
 * `/get-started` is the no-account preview: city, university, budget and
 * interests, then a look at what that buys. `/onboarding` is the real setup
 * after sign-up, and it asks for the same four things among its twelve. Until
 * this module existed nothing carried over, so a student who took the preview
 * answered the same questions twice, five minutes apart, which is the fastest
 * way to make a product feel like it is not listening.
 *
 * Now the preview writes its answers here and setup reads them back on open,
 * pre-filled and marked as coming from the preview. Session storage is right
 * for this: it survives the hop through `/signup`, the verification redirect
 * and Google's round trip because they all happen in the same tab, and it is
 * gone when the tab closes — nothing about a student sits on the device
 * longer than the sign-up does.
 *
 * Every access is wrapped. A blocked or corrupt storage entry must never stop
 * anyone signing up; the worst case is answering the questions again.
 * ============================================================================
 */

export const DRAFT_KEY = `${brand.slug}:onboarding-draft`;

/** Setup step ids the preview can answer. Used to label pre-filled steps. */
export type PreviewStep = "city" | "university" | "budget" | "interests";

/** What the preview hands over. Field names match setup's own answers. */
export type PreviewSeed = {
  citySlug: string;
  institutionId: string | null;
  campusSlug: string | null;
  universityName: string;
  monthlyTotal: string;
  /** The preview asks for money "after rent", so rent is always excluded. */
  excludeHousing: true;
  interests: string[];
  fromPreview: PreviewStep[];
};

export function readDraft(): Record<string, unknown> | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function writeDraft(draft: object): void {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* Private mode. Setup still works; it just starts empty. */
  }
}

export function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* Nothing to clean up if storage was never available. */
  }
}

/** Merge the preview's answers over whatever draft already exists. */
export function seedDraftFromPreview(seed: PreviewSeed): void {
  writeDraft({ ...(readDraft() ?? {}), ...seed });
}
