import { isGoogleConfigured } from "@/server/auth/google";

/**
 * "Continue with Google". Rendered as a real link to the OAuth start route when
 * the provider is configured, and as an honest one-line note when it is not —
 * never as a button that does nothing.
 */
export function GoogleButton({ next, label = "Continue with Google" }: { next?: string; label?: string }) {
  if (!isGoogleConfigured) {
    return (
      <p className="rounded-xl bg-paper-2 px-4 py-3 text-center text-[0.8125rem] text-ink-500">
        Google sign-in is not connected in this environment. Email and password work fully.
      </p>
    );
  }

  const href = next ? `/api/auth/google?next=${encodeURIComponent(next)}` : "/api/auth/google";

  return (
    <div className="space-y-4">
      <a
        href={href}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-full bg-white text-[0.9375rem] font-medium text-ink-900 ring-1 ring-ink-950/12 transition-colors hover:bg-paper-2"
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.9 1.5l2.6-2.6C16.9 3.1 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z" />
          <path fill="#34A853" d="M3.9 7.6l3.2 2.4C8 7.9 9.8 6.7 12 6.7c1.9 0 3.1.8 3.9 1.5l2.6-2.6C16.9 4 14.7 3 12 3 8.4 3 5.3 4.9 3.9 7.6z" opacity="0" />
        </svg>
        {label}
      </a>
      <div className="flex items-center gap-3 text-[0.75rem] text-ink-400">
        <span className="h-px flex-1 bg-ink-200" />
        or with email
        <span className="h-px flex-1 bg-ink-200" />
      </div>
    </div>
  );
}

/** The message shown when Google sends the browser back with a problem. */
export function googleReturnMessage(code: string | undefined): string | null {
  switch (code) {
    case "cancelled":
      return "Google sign-in was cancelled. Nothing changed.";
    case "unverified":
      return "That Google account's email is not verified with Google, so it cannot be used to sign in here.";
    case "invalid":
      return "That sign-in link had expired or did not match. Try again.";
    default:
      return null;
  }
}
