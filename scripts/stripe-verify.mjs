#!/usr/bin/env node
/**
 * ============================================================================
 * BILLING VERIFICATION
 * ----------------------------------------------------------------------------
 * Proves the Stripe configuration actually works, by using it. Charges nobody.
 *
 * The fourth of the family after db:verify, ai:verify and places:verify, and it
 * exists for the same reason they do: every failure mode here is SILENT. A
 * price id that points at the wrong amount looks exactly like one that points
 * at the right amount until a student is charged. A webhook endpoint missing
 * `customer.subscription.deleted` looks healthy until somebody cancels and
 * keeps their plan forever. `createCheckoutSession` catches every Stripe error
 * and returns `{ok: false, reason: "failed"}` — correct for a student staring
 * at a button, invisible to whoever deployed it.
 *
 * The check that matters most is #3: it reads each configured price back OUT of
 * Stripe and compares it against the application's own priceFor()/billedTotal().
 * Those functions are what the pricing table renders, so agreement between them
 * and Stripe is the only thing that makes "€79.92 billed yearly" a fact rather
 * than a hope. It is also arithmetic that is easy to get wrong by hand: annual
 * rounds the monthly equivalent BEFORE multiplying by twelve, so Plus annual is
 * 79.92, not 79.90.
 *
 *   pnpm stripe:verify
 *
 * Exits non-zero on any failure, so it can gate a deploy.
 * ============================================================================
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHmac } from "node:crypto";

import Stripe from "stripe";

import { plans, priceFor, billedTotal } from "@/config/pricing";

/* The version src/server/billing/stripe.ts pins. Verifying against a different
   one would prove something the application never does. */
const API_VERSION = "2026-08-26.dahlia";

/** Exactly the events src/app/api/stripe/webhook/route.ts switches on. */
const REQUIRED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
];

/* -------------------------------------------------------------------------- */
/* Output                                                                      */
/* -------------------------------------------------------------------------- */

const symbols = { pass: "  ok ", fail: "FAIL ", warn: "warn ", info: "     " };
let failures = 0;
let warnings = 0;

const pass = (message) => console.log(`${symbols.pass}${message}`);
const info = (message) => console.log(`${symbols.info}${message}`);

function fail(message, detail) {
  failures += 1;
  console.log(`${symbols.fail}${message}`);
  if (detail) for (const line of String(detail).split("\n")) info(line);
}

function warn(message, detail) {
  warnings += 1;
  console.log(`${symbols.warn}${message}`);
  if (detail) for (const line of String(detail).split("\n")) info(line);
}

/* -------------------------------------------------------------------------- */
/* Environment                                                                 */
/* -------------------------------------------------------------------------- */

async function loadEnvFiles() {
  for (const name of [".env.local", ".env"]) {
    let raw;
    try {
      raw = await readFile(join(process.cwd(), name), "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
    }
    info(`read ${name}`);
  }
}

/** Mode and kind from a key's prefix. Never returns any part of the key. */
function describeKey(key) {
  return { live: key.includes("_live_"), restricted: key.startsWith("rk_") };
}

/* -------------------------------------------------------------------------- */
/* The checks                                                                  */
/* -------------------------------------------------------------------------- */

async function main() {
  console.log("");
  console.log("StudentOS — billing verification");
  console.log("─".repeat(64));

  await loadEnvFiles();

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    fail(
      "STRIPE_SECRET_KEY is not set",
      "Nobody can subscribe. Paid features stay locked, which is the correct\n" +
        "failure — but it is a launch blocker. See PRODUCTION_SETUP.md → Stripe.",
    );
    return finish();
  }

  const secret = describeKey(secretKey);
  const stripe = new Stripe(secretKey, { apiVersion: API_VERSION });

  /* ---- 1. does the key work, and is the account able to charge? ---------- */

  /**
   * The account read is a NICE-TO-HAVE, never a gate.
   *
   * A correctly scoped restricted key does not carry Accounts Read, because
   * the application never reads the account — it creates checkout and portal
   * sessions and retrieves a subscription, and that is all. Failing here would
   * mean this script demands a broader key than the product does, which is
   * exactly the pressure that gets a full-access key deployed. So a permission
   * error is reported and stepped over; only a rejected key stops the run.
   */
  let account = null;
  try {
    account = await stripe.accounts.retrieve();
  } catch (error) {
    const permission = error.type === "StripePermissionError" || /does not have the required permissions/i.test(error.message);
    if (!permission) {
      fail(`the secret key was rejected: ${error.message}`, "Check it against Stripe → Developers → API keys.");
      return finish();
    }
  }

  pass(`${secret.live ? "live" : "test"} mode${secret.restricted ? ", restricted key" : ""}`);

  if (!account) {
    info("account details not readable with this key, which is correct for a scoped restricted key");
    info("so 'can this account accept charges' is not checked here — Stripe's dashboard is the source for that");
  } else {
    pass(`${account.id} · ${account.country} · default ${String(account.default_currency).toUpperCase()}`);
    if (secret.live && !account.charges_enabled) {
      fail(
        "the account cannot accept charges yet",
        "Stripe has not finished onboarding this account. Checkout will open and\n" + "then fail at payment.",
      );
    }
  }

  if (secret.live && !secret.restricted) {
    warn(
      "this is a full-access secret key",
      "The application only creates checkout and portal sessions and reads a\n" +
        "subscription. A restricted key limited to those cannot issue refunds or\n" +
        "move money if the server is ever compromised.",
    );
  }

  /* ---- 2. do the two keys agree about mode? ------------------------------ */

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    warn("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set");
  } else if (describeKey(publishableKey).live !== secret.live) {
    fail(
      "the publishable and secret keys are from different modes",
      "One is live and the other is test. Checkout fails at the browser, or\n" +
        "bills against data the other mode cannot see.",
    );
  } else {
    pass("publishable key agrees with the secret key about mode");
  }

  /* ---- 3. does every price charge what the pricing table promised? ------- */

  let configuredPrices = 0;
  for (const plan of plans) {
    if (plan.key === "free") continue;

    for (const period of ["monthly", "annual"]) {
      const variable = `STRIPE_PRICE_${plan.key.toUpperCase()}_${period.toUpperCase()}`;
      const priceId = process.env[variable];

      if (!priceId) {
        fail(`${variable} is not set`, `Checkout for ${plan.name} ${period} fails loudly rather than charging a wrong amount.`);
        continue;
      }

      let price;
      try {
        price = await stripe.prices.retrieve(priceId);
      } catch (error) {
        fail(`${variable} does not resolve: ${error.message}`);
        continue;
      }

      /* What the application's own functions say the student was promised. */
      const promised = period === "monthly" ? priceFor(plan, "monthly") : billedTotal(plan, "annual");
      const expectedMinor = Math.round(promised * 100);
      const expectedInterval = period === "monthly" ? "month" : "year";

      const problems = [];
      if (!price.active) problems.push("the price is archived");
      if (price.unit_amount !== expectedMinor)
        problems.push(`Stripe charges ${price.unit_amount}, the pricing table promises ${expectedMinor}`);
      if (price.currency !== "eur") problems.push(`currency is ${price.currency}, expected eur`);
      if (price.recurring?.interval !== expectedInterval)
        problems.push(`interval is ${price.recurring?.interval ?? "one-time"}, expected ${expectedInterval}`);
      if (price.recurring?.interval_count && price.recurring.interval_count !== 1)
        problems.push(`interval_count is ${price.recurring.interval_count}, expected 1`);

      if (problems.length) {
        fail(`${plan.name} ${period} is wrong`, problems.join("\n"));
      } else {
        configuredPrices += 1;
        pass(`${plan.name} ${period}: ${(price.unit_amount / 100).toFixed(2)} EUR every ${expectedInterval}`);
      }
    }
  }

  /* ---- 4. is there an endpoint, and does it carry every event? ----------- */

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    fail(
      "STRIPE_WEBHOOK_SECRET is not set",
      "Payments would complete and no entitlement would ever be granted: the\n" +
        "webhook refuses every unsigned request, with no development bypass.",
    );
  } else {
    /* Sign a payload with the configured secret and verify it the way the
       route does. This proves the value is a usable signing secret and that
       the verifier accepts what Stripe would send — without waiting for a
       real delivery. It cannot prove the secret belongs to THIS endpoint;
       check 4b does that by matching the URL. */
    try {
      const payload = JSON.stringify({ id: "evt_verify", object: "event", type: "ping" });
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = createHmac("sha256", webhookSecret).update(`${timestamp}.${payload}`).digest("hex");
      stripe.webhooks.constructEvent(payload, `t=${timestamp},v1=${signature}`, webhookSecret);
      pass("webhook signing secret verifies a signed payload");
    } catch (error) {
      fail(`the webhook signing secret does not verify a payload it signed: ${error.message}`);
    }
  }

  if (!siteUrl) {
    warn("NEXT_PUBLIC_SITE_URL is not set, so the endpoint URL cannot be checked");
  } else {
    const expectedUrl = `${siteUrl.replace(/\/$/, "")}/api/stripe/webhook`;
    let endpoints = [];
    try {
      endpoints = (await stripe.webhookEndpoints.list({ limit: 100 })).data;
    } catch (error) {
      warn(`could not list webhook endpoints: ${error.message}`, "A restricted key may not include the Webhook Endpoints permission.");
    }

    const endpoint = endpoints.find((row) => row.url === expectedUrl);
    if (!endpoints.length) {
      info("skipped endpoint check");
    } else if (!endpoint) {
      fail(`no webhook endpoint points at ${expectedUrl}`, `Endpoints found: ${endpoints.map((row) => row.url).join(", ") || "none"}`);
    } else {
      const missing = REQUIRED_EVENTS.filter(
        (event) => !endpoint.enabled_events.includes(event) && !endpoint.enabled_events.includes("*"),
      );
      if (endpoint.status !== "enabled") fail(`the endpoint is ${endpoint.status}, not enabled`);
      if (missing.length) {
        fail(
          `the endpoint does not send ${missing.join(", ")}`,
          "A missing subscription.deleted means a cancelled plan is never revoked.",
        );
      }
      if (endpoint.api_version && endpoint.api_version !== API_VERSION) {
        warn(
          `the endpoint sends API version ${endpoint.api_version}, the code pins ${API_VERSION}`,
          "A Stripe-side upgrade can change a payload shape the deployed code has never seen.",
        );
      }
      if (endpoint.status === "enabled" && !missing.length) {
        pass(`endpoint ${endpoint.id} sends all ${REQUIRED_EVENTS.length} required events`);
      }
    }
  }

  /* ---- 5. can a student actually manage their plan afterwards? ----------- */

  try {
    const configurations = await stripe.billingPortal.configurations.list({ limit: 3 });
    if (configurations.data.length === 0) {
      fail(
        "no billing portal configuration exists",
        "createPortalSession() fails outright, so cancelling and switching plan —\n" +
          "which the product routes to the portal deliberately — are dead ends.",
      );
    } else {
      pass(`billing portal configured (${configurations.data[0].id})`);
    }
  } catch (error) {
    warn(`could not read billing portal configuration: ${error.message}`);
  }

  /* ---- 6. does a real checkout session open? ----------------------------- */

  /**
   * The end-to-end proof, and the only one that exercises the same call the
   * upgrade button makes. A Checkout Session costs nothing and charges nobody
   * until it is paid; this one is expired immediately so it cannot be opened.
   */
  const probePriceId = process.env.STRIPE_PRICE_PLUS_MONTHLY;
  if (!probePriceId) {
    info("skipped the checkout probe: no Plus monthly price id");
  } else {
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: probePriceId, quantity: 1 }],
        customer_email: "verify@studentos.invalid",
        client_reference_id: "verify-probe",
        success_url: `${siteUrl ?? "https://example.com"}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl ?? "https://example.com"}/upgrade?cancelled=1`,
        allow_promotion_codes: true,
      });
      pass(`checkout session opens (${session.id})`);

      try {
        await stripe.checkout.sessions.expire(session.id);
        info("probe session expired; it cannot be opened by anyone");
      } catch {
        warn(`probe session ${session.id} could not be expired`, "It is unpaid and harmless, and Stripe expires it within 24 hours.");
      }
    } catch (error) {
      fail(
        `a checkout session could not be created: ${error.message}`,
        "This is the exact call the upgrade button makes. createCheckoutSession()\n" +
          "swallows this error and shows the student 'Could not start checkout.'",
      );
    }
  }

  if (configuredPrices === 6) info(`all six prices agree with src/config/pricing.ts`);

  return finish();
}

function finish() {
  console.log("─".repeat(64));
  if (failures === 0 && warnings === 0) console.log("billing is connected and correct.");
  else if (failures === 0) console.log(`billing works, with ${warnings} warning(s) above.`);
  else console.log(`${failures} failure(s), ${warnings} warning(s). Billing is NOT ready.`);
  console.log("");
  process.exit(failures === 0 ? 0 : 1);
}

await main();
