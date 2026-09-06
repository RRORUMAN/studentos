"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Info, TriangleAlert, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";

type ToastTone = "success" | "info" | "warning";

type Toast = {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
};

type ToastInput = Omit<Toast, "id" | "tone"> & { tone?: ToastTone };

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

/**
 * Confirmation for actions that would otherwise be silent — saving a plan,
 * copying a link, joining a group. Announced politely so screen readers get
 * the same feedback sighted users get.
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return context;
}

const TONE_META: Record<ToastTone, { icon: typeof Check; className: string }> = {
  success: { icon: Check, className: "text-mint" },
  info: { icon: Info, className: "text-signal" },
  warning: { icon: TriangleAlert, className: "text-amber" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { id, tone: "success", ...input }]);
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  const reduced = useReducedMotion();

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-100 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const { icon: Icon, className } = TONE_META[toast.tone];
          return (
            <motion.div
              role="status"
              key={toast.id}
              layout={!reduced}
              initial={reduced ? false : { opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
              transition={reduced ? { duration: 0 } : spring.snappy}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg bg-ink-950 p-3.5 pr-2.5 text-white shadow-[var(--shadow-lift)]"
              data-surface="dark"
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", className)} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-0.5 text-sm text-white/60">{toast.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="-m-1 rounded-full p-1 text-white/40 transition-colors hover:text-white"
                aria-label="Dismiss notification"
              >
                <X className="size-4" aria-hidden />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
