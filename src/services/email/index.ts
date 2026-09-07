import { brand } from "@/brand/brand.config";
import { env } from "@/services/env";
import { captureError } from "@/services/monitoring";

/**
 * ============================================================================
 * TRANSACTIONAL EMAIL — Resend
 * ----------------------------------------------------------------------------
 * A closed set of templates, each triggered by something the student did.
 * Marketing blasts are not part of this contract.
 *
 * Sent over Resend's REST API with `fetch`. No SDK: there is one endpoint, it
 * takes JSON, and a dependency whose job is to build one POST body is a
 * dependency that has to be kept current for no benefit.
 *
 * This file used to return `{ ok: false, reason: "not-implemented" }` — with a
 * valid key, from every path. The consequences were not small. Verification and
 * password-reset links were never delivered; the sign-up flow only worked
 * because the token is also shown on screen, which is the fallback for a
 * deployment with no key and is not something that should ever be reachable in
 * public. Anything in here that cannot send has to say so in its return value,
 * because two call sites decide what to tell a student based on it.
 * ============================================================================
 */

const ENDPOINT = "https://api.resend.com/emails";

/** A send must never hold a request open. Resend is normally well under this. */
const TIMEOUT_MS = 8_000;

export type EmailTemplate =
  | "verify-email"
  | "reset-password"
  | "duplicate-signup"
  | "waitlist-confirmed"
  | "city-opened"
  | "invite-received"
  | "weekly-plan";

export type SendResult = { ok: true; id: string } | { ok: false; reason: string };

/* -------------------------------------------------------------------------- */
/* Templates                                                                   */
/* -------------------------------------------------------------------------- */

type TemplateData = Record<string, string | number>;
type Rendered = { subject: string; heading: string; body: string[]; action?: { label: string; url: string } };

function text(data: TemplateData, key: string, fallback = ""): string {
  const value = data[key];
  return value === undefined ? fallback : String(value);
}

/**
 * Every template, as structure rather than markup.
 *
 * Returning parts instead of HTML means the plain-text alternative is generated
 * from the same source. A text part is not optional politeness: a message with
 * only an HTML body scores worse with spam filters, and a verification email in
 * a spam folder is a sign-up funnel that looks broken for a reason nobody can
 * see from the inside.
 */
function render(template: EmailTemplate, data: TemplateData): Rendered {
  switch (template) {
    case "verify-email":
      return {
        subject: `Confirm your email for ${brand.name}`,
        heading: "One tap and you're in",
        body: [
          "Confirm this address to finish setting up your account.",
          "If you didn't sign up, you can ignore this — nothing happens until the link is used, and it expires on its own.",
        ],
        action: { label: "Confirm my email", url: text(data, "url") },
      };

    case "reset-password":
      return {
        subject: `Reset your ${brand.name} password`,
        heading: "Set a new password",
        body: [
          "Use the link below to choose a new password. It expires shortly and can only be used once.",
          "If you didn't ask for this, nothing has changed and you can ignore this message. Somebody may have typed your address by mistake.",
        ],
        action: { label: "Choose a new password", url: text(data, "url") },
      };

    case "duplicate-signup":
      /* Sent to the address that already has an account, when somebody tries to
         sign up with it again. The person at the keyboard is told the same
         thing either way, so this is the only place the difference is visible —
         and it goes to the real owner, who is the one who needs to know. */
      return {
        subject: `Somebody tried to sign up with your ${brand.name} address`,
        heading: "You already have an account",
        body: [
          "Someone just tried to create an account with this email address. If that was you, sign in instead — your account is already there.",
          "If it wasn't you, nothing has happened and no account was created. Your password is unchanged.",
        ],
        action: { label: "Sign in", url: text(data, "url") },
      };

    case "waitlist-confirmed":
      return {
        subject: `You're on the list for ${text(data, "city", "your city")}`,
        heading: `We'll write when ${text(data, "city", "your city")} opens`,
        body: [
          `You asked to hear when ${brand.name} opens in ${text(data, "city", "your city")}. One email when it does — nothing else.`,
        ],
      };

    case "city-opened":
      return {
        subject: `${text(data, "city", "Your city")} is open on ${brand.name}`,
        heading: `${text(data, "city", "Your city")} is live`,
        body: [`You asked to be told. Here it is.`],
        action: { label: "Have a look", url: text(data, "url") },
      };

    case "invite-received":
      return {
        subject: `${text(data, "from", "A student")} invited you to something`,
        heading: "You've been invited",
        body: [`${text(data, "from", "A student")} invited you to ${text(data, "what", "a plan")}.`],
        action: { label: "See the invite", url: text(data, "url") },
      };

    case "weekly-plan":
      return {
        subject: `Your week on ${brand.name}`,
        heading: "What's coming up",
        body: [text(data, "summary", "Your plans for the week ahead.")],
        action: { label: "Open my week", url: text(data, "url") },
      };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Inline styles and a table-free single column.
 *
 * Not a design choice — email clients strip `<style>` blocks, and Outlook's
 * renderer is not a browser. Kept deliberately plain so it degrades to
 * something readable everywhere rather than looking broken in half of them.
 */
function toHtml(rendered: Rendered): string {
  const paragraphs = rendered.body
    .map(
      (line) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3b3a38">${escapeHtml(line)}</p>`,
    )
    .join("");

  const action = rendered.action?.url
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(rendered.action.url)}" style="display:inline-block;padding:12px 20px;background:#1c1b1a;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600">${escapeHtml(rendered.action.label)}</a></p>
       <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#78736c">If the button doesn't work, paste this into your browser:<br>${escapeHtml(rendered.action.url)}</p>`
    : "";

  return `<div style="margin:0;padding:24px;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e7e3dd;border-radius:12px;padding:32px">
    <p style="margin:0 0 24px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#78736c">${escapeHtml(brand.name)}</p>
    <h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;color:#1c1b1a">${escapeHtml(rendered.heading)}</h1>
    ${paragraphs}${action}
  </div>
</div>`;
}

function toText(rendered: Rendered): string {
  const parts = [rendered.heading, "", ...rendered.body];
  if (rendered.action?.url) parts.push("", `${rendered.action.label}: ${rendered.action.url}`);
  parts.push("", brand.name);
  return parts.join("\n");
}

/* -------------------------------------------------------------------------- */
/* Sending                                                                     */
/* -------------------------------------------------------------------------- */

export async function sendTemplate(input: {
  to: string;
  template: EmailTemplate;
  data: Record<string, string | number>;
}): Promise<SendResult> {
  if (!env.resend.apiKey) return { ok: false, reason: "not-configured" };
  if (!env.resend.from) return { ok: false, reason: "no-from-address" };

  const rendered = render(input.template, input.data);

  /* A link template with no link is a bug that must not reach an inbox: the
     student gets a button that goes nowhere and no way to tell it apart from a
     phishing attempt. Caught here rather than sent. */
  if (rendered.action && !rendered.action.url) {
    captureError(new Error(`email template ${input.template} rendered without a link`), {
      template: input.template,
    });
    return { ok: false, reason: "missing-link" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.resend.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.resend.from,
        to: [input.to],
        subject: rendered.subject,
        html: toHtml(rendered),
        text: toText(rendered),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      /* Resend's body names the cause — an unverified domain, a bad key, a
         blocked recipient — and every one of those is something the operator
         has to see. The address is not logged with it. */
      const detail = await response.text().catch(() => "");
      captureError(new Error(`Resend returned ${response.status}: ${detail.slice(0, 300)}`), {
        template: input.template,
        status: response.status,
      });
      return { ok: false, reason: `resend-${response.status}` };
    }

    const body = (await response.json()) as { id?: string };
    return body.id ? { ok: true, id: body.id } : { ok: false, reason: "no-id" };
  } catch (error) {
    captureError(error, { template: input.template, stage: "send" });
    return { ok: false, reason: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * An absolute link for an email.
 *
 * Emails cannot carry relative URLs, and `NEXT_PUBLIC_SITE_URL` is the only
 * thing that knows where this deployment lives. Returns null when it is unset,
 * so a caller sends nothing rather than a link to `undefined/verify-email`.
 */
export function absoluteUrl(path: string): string | null {
  if (!env.siteUrl) return null;
  return `${env.siteUrl.replace(/\/$/, "")}${path}`;
}
