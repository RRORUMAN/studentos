"use client";

import { AlertCircle, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { PASSWORD_MIN_LENGTH } from "@/config/auth";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * AUTH FORM KIT
 * ----------------------------------------------------------------------------
 * The inputs every auth screen is built from.
 *
 * Progressive enhancement is the point: each field is a real `<input>` inside a
 * real `<form>` pointed at a Server Action, so the whole flow works before any
 * JavaScript loads. The client bits below only add the things that genuinely
 * need a client — a show/hide toggle, a pending spinner, live password strength.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* Field                                                                       */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required = true,
  defaultValue,
  invalid = false,
  hint,
  ...props
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
  invalid?: boolean;
  hint?: string;
} & Omit<React.ComponentProps<"input">, "name" | "type" | "defaultValue">) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink-800">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={invalid || undefined}
        aria-describedby={hint ? hintId : undefined}
        className={cn(
          "h-12 w-full rounded-md border bg-white px-3.5 text-[0.9375rem] text-ink-900",
          "placeholder:text-ink-400",
          "transition-[border-color,box-shadow] duration-150",
          invalid
            ? "border-pulse-deep/50 bg-pulse-soft/40"
            : "border-ink-200 hover:border-ink-300",
        )}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-[0.8125rem] text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Password                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A password field with a reveal toggle and, when `showStrength` is set, a live
 * length meter.
 *
 * The meter measures length and variety and says so plainly. It deliberately
 * does not enforce composition rules — those push people towards `Password1!`,
 * which is worse than a long passphrase by every measure anyone has published.
 */
export function PasswordField({
  label = "Password",
  name = "password",
  autoComplete = "current-password",
  invalid = false,
  showStrength = false,
  hint,
}: {
  label?: string;
  name?: string;
  autoComplete?: string;
  invalid?: boolean;
  showStrength?: boolean;
  hint?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");

  const longEnough = value.length >= PASSWORD_MIN_LENGTH;
  const variety = new Set(value.replace(/[a-z]/g, "a").replace(/[A-Z]/g, "A").replace(/\d/g, "0"))
    .size;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink-800">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          required
          autoComplete={autoComplete}
          aria-invalid={invalid || undefined}
          onChange={showStrength ? (event) => setValue(event.target.value) : undefined}
          className={cn(
            "h-12 w-full rounded-md border bg-white pr-12 pl-3.5 text-[0.9375rem] text-ink-900",
            "transition-[border-color,box-shadow] duration-150",
            invalid ? "border-pulse-deep/50 bg-pulse-soft/40" : "border-ink-200 hover:border-ink-300",
          )}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-full text-ink-400 hover:text-ink-700"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>

      {showStrength ? (
        <div className="flex items-center gap-2 pt-0.5">
          <span
            aria-hidden
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              value.length === 0
                ? "bg-ink-200"
                : longEnough && variety >= 3
                  ? "bg-mint"
                  : longEnough
                    ? "bg-signal"
                    : "bg-amber",
            )}
          />
          <span className="text-[0.8125rem] text-ink-500">
            {value.length === 0
              ? `${PASSWORD_MIN_LENGTH}+ characters`
              : longEnough
                ? "Good length"
                : `${PASSWORD_MIN_LENGTH - value.length} more`}
          </span>
        </div>
      ) : null}

      {hint ? <p className="text-[0.8125rem] text-ink-500">{hint}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Messages                                                                    */
/* -------------------------------------------------------------------------- */

export function FormMessage({ tone, children }: { tone: "error" | "ok"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-md px-3 py-2.5 text-[0.875rem]",
        tone === "error"
          ? "bg-pulse-soft text-pulse-deep"
          : "bg-mint-soft text-mint-deep",
      )}
    >
      {tone === "error" ? (
        <AlertCircle className="mt-px size-4 shrink-0" />
      ) : (
        <Check className="mt-px size-4 shrink-0" />
      )}
      <span>{children}</span>
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Submit                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Reads pending state from the enclosing form rather than taking a prop, so a
 * form can have several submits and none of them need to be told.
 */
export function SubmitButton({ children, ...props }: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="primary"
      size="lg"
      block
      disabled={pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}
