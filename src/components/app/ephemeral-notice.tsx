import { TriangleAlert } from "lucide-react";

/**
 * The standing notice for a deployment with no database behind it.
 *
 * On a serverless host the JSON store writes to the instance's temp directory:
 * every restart wipes it and two instances do not share it. An account created
 * here can be gone tomorrow. Saying so on every page is the only honest way to
 * run such a deployment in public; the alternative is a student who budgets
 * for a week and finds it erased. Not dismissible, and not silenced by any env
 * var — see `isEphemeralStore` in `src/services/env.ts`.
 */
export function EphemeralDataNotice() {
  return (
    <div className="border-b border-amber-deep/15 bg-amber-soft/70">
      <p className="page flex items-start gap-2.5 py-2.5 text-[0.8125rem] leading-snug text-amber-deep">
        <TriangleAlert className="mt-px size-4 shrink-0" />
        <span>
          <span className="font-semibold">Preview server, nothing is kept.</span> This deployment has
          no database yet. Accounts, budgets and posts last only until the server restarts, and can
          differ between visits. Look around, but do not rely on it.
        </span>
      </p>
    </div>
  );
}
