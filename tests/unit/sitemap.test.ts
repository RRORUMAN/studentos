import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";

import { CITY_SECTIONS } from "../../src/app/sitemap.ts";

/**
 * ============================================================================
 * THE SITEMAP POINTS AT PAGES THAT EXIST
 * ----------------------------------------------------------------------------
 * A sitemap is the one file whose errors are invisible from inside the
 * product: nothing renders it, no page links to it, and a wrong entry costs
 * you a page in search rather than throwing.
 *
 * `"pulse"` was listed for months. The authenticated app was renamed Loop to
 * Pulse, this list followed the rename, and the marketing route did not — so
 * five submitted URLs 404ed and the five real community pages, which are
 * linked from every city page and have their own `generateStaticParams`, were
 * never submitted at all.
 * ============================================================================
 */
describe("the sitemap", () => {
  it("names only city sections that exist as routes", () => {
    const missing = CITY_SECTIONS.filter(
      (section) => !existsSync(`src/app/(marketing)/city/[slug]/${section}/page.tsx`),
    );

    assert.deepEqual(
      missing,
      [],
      `the sitemap submits ${missing.join(", ")}, which has no route file and will 404`,
    );
  });

  it("covers every city section route that exists", () => {
    /* The other direction, and the one that actually bit: a real page missing
       from the sitemap is invisible to search and nothing anywhere complains. */
    const onDisk = ["cheap-food", "free-events", "loop", "starter-pack", "student-deals", "things-to-do"];
    const absent = onDisk.filter((section) => !CITY_SECTIONS.includes(section as never));

    assert.deepEqual(absent, [], `these routes exist but are not in the sitemap: ${absent.join(", ")}`);
  });
});
