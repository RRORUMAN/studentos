import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * ============================================================================
 * TEXT CONTRAST
 * ----------------------------------------------------------------------------
 * That the colours the product actually writes text in are readable.
 *
 * `ink-400` shipped at #90909f — 3.15:1 on a white card, 3.01:1 on the paper
 * background, against the 4.5:1 that WCAG AA asks for body text. It was used in
 * 485 places, and always for the same thing: the secondary line. The price note
 * under a card, the date a figure was checked, the hint under a form field.
 * Precisely the text somebody reads when they are tired, on a phone, outdoors.
 *
 * Nothing catches this by looking, because it looks fine to whoever picked it.
 * It is arithmetic, so it can be a test.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* WCAG 2.1 relative luminance                                                 */
/* -------------------------------------------------------------------------- */

function channels(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

/** sRGB gamma expansion, per WCAG 2.1 relative-luminance. */
const expand = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map(expand);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/* -------------------------------------------------------------------------- */
/* The palette, read from the stylesheet rather than restated                   */
/* -------------------------------------------------------------------------- */

/**
 * Parsed from `globals.css` on purpose. A copy of the hex values here would be
 * a second source of truth that passes while the real palette regresses.
 */
function token(name: string): string {
  const css = readFileSync("src/app/globals.css", "utf8");
  const match = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  assert.ok(match, `--color-${name} not found in globals.css`);
  return match[1].toLowerCase();
}

/** Both surfaces text sits on: the page, and the cards laid over it. */
const SURFACES = [
  ["paper", () => token("paper")],
  ["white cards", () => "#ffffff"],
] as const;

/** WCAG AA: 4.5:1 for body text, 3:1 for large text. */
const AA_BODY = 4.5;

describe("text colours clear WCAG AA", () => {
  it("computes a known ratio correctly", () => {
    /* Black on white is 21:1 exactly, and a colour against itself is 1:1.
       If the maths below is wrong, everything else here is decoration. */
    assert.equal(Math.round(contrast("#000000", "#ffffff")), 21);
    assert.equal(contrast("#123456", "#123456"), 1);
  });

  for (const ink of ["ink-400", "ink-500", "ink-600", "ink-700", "ink-800", "ink-900"]) {
    it(`${ink} is readable as body text on every surface`, () => {
      for (const [label, surface] of SURFACES) {
        const ratio = contrast(token(ink), surface());
        assert.ok(
          ratio >= AA_BODY,
          `${ink} is ${ratio.toFixed(2)}:1 on ${label}, below the ${AA_BODY}:1 AA needs`,
        );
      }
    });
  }

  it("keeps the muted steps far enough apart to read as a scale", () => {
    /**
     * The reason 400, 500 and 600 all moved rather than 400 alone. Pulling 400
     * down to AA on its own left it four hex units from 500 — compliant, and no
     * longer a hierarchy. A ramp whose steps are indistinguishable is not a
     * ramp.
     */
    const steps = ["ink-400", "ink-500", "ink-600", "ink-700"].map(token);
    for (let i = 0; i < steps.length - 1; i += 1) {
      const separation = contrast(steps[i], steps[i + 1]);
      assert.ok(
        separation >= 1.2,
        `${steps[i]} and ${steps[i + 1]} are ${separation.toFixed(2)}:1 apart — too close to tell`,
      );
    }
  });

  it("gets darker at every step, with no accidental inversion", () => {
    const inks = ["ink-300", "ink-400", "ink-500", "ink-600", "ink-700", "ink-800", "ink-900"];
    const ratios = inks.map((ink) => contrast(token(ink), "#ffffff"));
    for (let i = 0; i < ratios.length - 1; i += 1) {
      assert.ok(
        ratios[i] < ratios[i + 1],
        `${inks[i]} (${ratios[i].toFixed(2)}) is darker than ${inks[i + 1]} (${ratios[i + 1].toFixed(2)})`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Accents                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The same argument as the ink ramp above, for the other half of the palette.
 *
 * Each accent is a pair: `--color-x` is a background — lime on ink, coral on
 * ink — and `--color-x-deep` is what that accent looks like as a WORD on paper.
 * Legibility as text is the deep variant's entire reason to exist, so it is
 * the thing worth pinning.
 *
 * `signal-deep` shipped at #7f9c0d: 3.02:1 on paper, used in 38 places as
 * `text-signal-deep`. The ink ramp got this treatment and the accents did not,
 * so it survived. It was also the only one of the five below AA — pulse 5.23,
 * flow 9.37, mint 5.42, amber 5.06 — which is what makes it one token out of
 * step with its own family rather than a decision the palette had made.
 */
const ACCENTS = ["signal-deep", "pulse-deep", "flow-deep", "mint-deep", "amber-deep"] as const;

describe("accent text clears WCAG AA", () => {
  for (const accent of ACCENTS) {
    it(`${accent} is readable as body text on every surface`, () => {
      for (const [label, surface] of SURFACES) {
        const ratio = contrast(token(accent), surface());
        assert.ok(
          ratio >= AA_BODY,
          `${accent} is ${ratio.toFixed(2)}:1 on ${label}, below the ${AA_BODY}:1 AA needs`,
        );
      }
    });
  }

  it("keeps signal-deep readable on the raised surfaces too", () => {
    /* paper-2 and paper-3 paint a card and a nested card, and they are darker
       than either surface above — so they are the harder case, and the one an
       eye check on a white background misses.

       Only signal-deep is held to this. pulse-deep (4.38) and amber-deep
       (4.24) sit just under on paper-3 and predate this test; moving them is a
       colour decision about two more tokens, not something this test found. */
    const ratio = contrast(token("signal-deep"), token("paper-3"));
    assert.ok(ratio >= AA_BODY, `signal-deep is ${ratio.toFixed(2)}:1 on paper-3`);
  });

  it("keeps signal-deep inside the band its siblings occupy", () => {
    /* The fix was to bring one outlier into line, not to invent a new rule. A
       value far darker than the family stops reading as the same palette,
       which is why the original was chosen where it was. */
    const ratio = contrast(token("signal-deep"), token("paper"));
    assert.ok(ratio <= 10, `signal-deep is ${ratio.toFixed(2)}:1, darker than the whole family`);
  });
});
