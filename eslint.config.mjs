import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * ============================================================================
 * LINT
 * ----------------------------------------------------------------------------
 * Next's two presets, plus the one project rule a preset cannot know about.
 *
 * WHY THE DATE RULE EXISTS. `CLAUDE.md` has said "never `toLocaleString` in a
 * component" since early on, and by 2026-09-10 eleven call sites were doing it
 * anyway — in two pure engines, a server action, two client components and
 * three pages. Every one of them rendered a day of the week in the timezone of
 * whatever machine happened to run the code, which on Vercel is UTC and for the
 * student is not. A written convention with no check is a convention that decays
 * at exactly the rate people forget it, so this one is now enforced.
 *
 * `src/lib/dates.ts` is the only file allowed to format a date, because it is
 * the only file that takes the city's zone as an argument and therefore the only
 * one that can be correct. Everything else calls it.
 * ============================================================================
 */
const dateFormattingRule = {
  rules: {
    "no-restricted-syntax": [
      "error",
      /* Only the two date methods. `toLocaleString` on a number is thousands
         separators and has nothing to do with a timezone, so banning it would
         train people to add an eslint-disable beside a correct line — which is
         how a rule stops being read. */
      {
        selector: "MemberExpression[property.name='toLocaleDateString']",
        message:
          "Format dates through src/lib/dates.ts, which takes the city's timeZone. toLocaleDateString renders in the zone of whatever machine runs it — UTC on Vercel — so it prints the wrong day for a student either side of midnight.",
      },
      {
        selector: "MemberExpression[property.name='toLocaleTimeString']",
        message:
          "Format times through src/lib/dates.ts (`fmtTime`), which takes the city's timeZone. toLocaleTimeString renders in the server's or the browser's zone.",
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/dates.ts"],
    ...dateFormattingRule,
  },
]);

export default eslintConfig;
