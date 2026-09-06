import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

import { brand } from "@/brand/brand.config";

/**
 * The type scale declared in globals.css `@theme`.
 *
 * tailwind-merge does not read the stylesheet, so out of the box it cannot tell
 * `text-display-lg` (a size) from `text-ink-950` (a colour) — it assumes the
 * latter and treats them as conflicting. The result is silent and severe:
 * `cn("text-display-lg text-ink-950")` returns just `text-ink-950`, and every
 * heading that reaches the DOM through `cn` renders at 16px.
 *
 * Registering the names here restores the distinction. Any new `--text-*` token
 * added to globals.css must be added to this list too.
 */
const displaySizes = [
  "micro",
  "display-xs",
  "display-sm",
  "display-md",
  "display-lg",
  "display-xl",
  "display-2xl",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...displaySizes] }],
    },
  },
});

/** Merge conditional class names, resolving Tailwind conflicts last-wins. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Where a price is being shown. Omitted means the brand default. */
export type MoneyLocale = { currency?: string; locale?: string };

/**
 * `Intl.NumberFormat` construction is not free and `money()` runs on every row
 * of every plan, feed and budget panel, so formatters are memoised per
 * currency+locale+precision rather than rebuilt per call.
 */
const formatterCache = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, locale: string, fractionDigits: 0 | 2) {
  const key = `${locale}|${currency}|${fractionDigits}`;
  let cached = formatterCache.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    formatterCache.set(key, cached);
  }
  return cached;
}

/**
 * Money is the product's most repeated primitive, so it gets one formatter.
 * Whole amounts render as "€18", amounts with cents as "€18.50". Never "€18.00"
 * (reads like a spreadsheet) and never "€8.5" (reads like a bug).
 *
 * The currency is a parameter because the product is used worldwide: a student
 * in Tokyo is shown ¥1,200 and a student in London £8.50, from the same call
 * site. Zero-decimal currencies (JPY, KRW, CLP…) never get a cents form —
 * `Intl` knows which those are, so the check asks it rather than hardcoding a
 * list.
 */
export function money(amount: number, where: MoneyLocale = {}): string {
  const currency = where.currency ?? brand.currency.code;
  const locale = where.locale ?? brand.currency.locale;

  const zeroDecimal =
    formatter(currency, locale, 2).resolvedOptions().maximumFractionDigits === 0;
  const hasCents = !zeroDecimal && Math.round(amount * 100) % 100 !== 0;

  return formatter(currency, locale, hasCents ? 2 : 0).format(amount);
}

/** The bare symbol for a currency, for axis labels and compact chips. */
export function currencySymbol(currency: string, locale?: string): string {
  const parts = formatter(currency, locale ?? brand.currency.locale, 0).formatToParts(0);
  return parts.find((part) => part.type === "currency")?.value ?? currency;
}

/** Compact counts for social proof: 284, 1.2k, 18k. */
export function count(value: number): string {
  if (value < 1000) return String(value);
  const k = value / 1000;
  return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k`;
}

/** "9 min" walking labels. Distances are always shown as time, never metres. */
export function walk(minutes: number): string {
  return `${minutes} min`;
}

/** Combining diacritical marks, built from escapes so the source stays ASCII. */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Relative time for feed items, kept deliberately coarse and human. */
export function ago(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / (60 * 24))}d`;
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
