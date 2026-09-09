import type { LanguageCode, PhrasePack } from "@/domain/language";
import { spanish } from "@/data/language/es";
import { german } from "@/data/language/de";
import { dutch } from "@/data/language/nl";
import { french } from "@/data/language/fr";
import { italian } from "@/data/language/it";
import { portuguese } from "@/data/language/pt";
import {
  czech,
  english,
  estonian,
  finnish,
  hungarian,
  polish,
  swedish,
} from "@/data/language/starters";

/**
 * ============================================================================
 * PHRASE PACKS
 * ----------------------------------------------------------------------------
 * Every pack the product has, and the only place that knows they exist.
 *
 * Depth differs and is declared rather than hidden. Spanish is a full pack
 * because Madrid is the city this product was built around; German, Dutch,
 * French, Italian and Portuguese are core packs; the rest are starter packs of
 * around eighteen phrases. `coverage` is rendered next to the language name
 * everywhere it appears, so nobody has to guess which one they are getting.
 *
 * Adding a language is a file next to this one and a line below. Nothing else
 * in the product names a language: the city says which country it is in, and
 * `localLanguageFor` in the domain does the rest.
 * ============================================================================
 */

const PACKS: readonly PhrasePack[] = [
  spanish,
  german,
  dutch,
  french,
  italian,
  portuguese,
  polish,
  czech,
  hungarian,
  finnish,
  swedish,
  estonian,
  english,
];

const byCode = new Map<LanguageCode, PhrasePack>(PACKS.map((pack) => [pack.code, pack]));

/** The pack for a language, or null when there is not one yet. */
export function packFor(code: LanguageCode | null | undefined): PhrasePack | null {
  if (!code) return null;
  return byCode.get(code) ?? null;
}

/** Every pack, for the language picker and the admin view. */
export const packs: readonly PhrasePack[] = PACKS;

/** Languages a student can choose to learn, ordered by how much there is. */
export function offeredLanguages(): { code: LanguageCode; name: string; endonym: string; count: number; coverage: PhrasePack["coverage"] }[] {
  const rank = { full: 0, core: 1, starter: 2 } as const;
  return PACKS.map((pack) => ({
    code: pack.code,
    name: pack.name,
    endonym: pack.endonym,
    count: pack.phrases.length,
    coverage: pack.coverage,
  })).sort((a, b) => rank[a.coverage] - rank[b.coverage] || a.name.localeCompare(b.name));
}
