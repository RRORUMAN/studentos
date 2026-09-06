import { brand } from "@/brand/brand.config";
import { env } from "@/services/env";

/**
 * ============================================================================
 * TRANSACTIONAL EMAIL — Resend
 * ----------------------------------------------------------------------------
 * A closed set of templates. Marketing blasts are not part of this contract;
 * everything here is triggered by something the student did.
 * ============================================================================
 */

export type EmailTemplate =
  | "waitlist-confirmed"
  | "city-opened"
  | "invite-received"
  | "weekly-plan";

export type SendResult = { ok: true; id: string } | { ok: false; reason: string };

export async function sendTemplate(input: {
  to: string;
  template: EmailTemplate;
  data: Record<string, string | number>;
}): Promise<SendResult> {
  if (!env.resend.apiKey) {
    return { ok: false, reason: "not-configured" };
  }
  void input;
  void brand;
  return { ok: false, reason: "not-implemented" };
}
