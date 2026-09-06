import assert from "node:assert/strict";
import { test } from "node:test";

import { formatLocaleFor } from "../../src/lib/locale.ts";

const madrid = { locale: "es-ES", currency: { code: "EUR", symbol: "€" } };
const boston = { locale: "en-US", currency: { code: "USD", symbol: "$" } };

test("English interface formats euro cities the British way, so € leads", () => {
  assert.equal(formatLocaleFor("en", madrid), "en-GB");
  assert.equal(new Intl.NumberFormat(formatLocaleFor("en", madrid), { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(900), "€900");
});

test("English in a dollar city uses US formatting", () => {
  assert.equal(formatLocaleFor("en", boston), "en-US");
});

test("the city's own language keeps the city's locale; another language stands alone", () => {
  assert.equal(formatLocaleFor("es", madrid), "es-ES");
  assert.equal(formatLocaleFor("de", madrid), "de");
  assert.equal(formatLocaleFor(undefined, madrid), "en-GB");
});
