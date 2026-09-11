"use client";

import dynamic from "next/dynamic";

/**
 * Setup renders on the client only, and deliberately.
 *
 * It opens on whatever the public preview left in `sessionStorage`, which the
 * server cannot see. Rendering it on the server produced HTML for an empty
 * setup and the client then rendered a pre-filled one over it: a hydration
 * mismatch on every sign-up that came through `/get-started`, which after the
 * draft hand-over is most of them. Skipping the server render removes the
 * disagreement instead of papering over it.
 *
 * `ssr: false` is only allowed inside a client component in this version of
 * Next, which is the whole reason this file exists.
 */
const SetupFlow = dynamic(
  () => import("@/components/onboarding/setup-flow").then((module) => module.SetupFlow),
  { ssr: false, loading: () => <SetupSkeleton /> },
);

export function SetupFlowClient() {
  return <SetupFlow />;
}

/** Same footprint as the first step, so nothing jumps when it arrives. */
function SetupSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-5xl">
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <span key={index} className="h-1 rounded-full bg-ink-200" />
        ))}
      </div>
      <div className="mt-10 max-w-lg space-y-3">
        <span className="block h-8 w-2/3 rounded-lg bg-ink-100" />
        <span className="block h-4 w-1/2 rounded bg-ink-100" />
        <span className="mt-6 block h-16 rounded-2xl bg-ink-100/70" />
        <span className="block h-16 rounded-2xl bg-ink-100/70" />
        <span className="block h-16 rounded-2xl bg-ink-100/70" />
      </div>
    </div>
  );
}
