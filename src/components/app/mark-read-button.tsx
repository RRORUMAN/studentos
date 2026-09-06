"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { markNotificationsRead } from "@/server/actions/notifications";

export function MarkAllReadButton({ count }: { count: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (count === 0) return null;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markNotificationsRead();
          router.refresh();
        })
      }
      className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[0.8125rem] font-medium text-ink-700 ring-1 ring-ink-950/8 hover:ring-ink-950/20"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
      Mark all read
    </button>
  );
}
