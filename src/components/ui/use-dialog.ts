"use client";

import { useEffect, useRef } from "react";

/**
 * ============================================================================
 * WHAT A DIALOG OWES THE KEYBOARD
 * ----------------------------------------------------------------------------
 * `role="dialog"` and `aria-modal="true"` are a PROMISE to assistive
 * technology: nothing behind this is reachable. Five dialogs in this product
 * made that promise and kept none of it — Tab walked straight out of the sheet
 * and into the page underneath, where a screen reader user was then reading
 * content the dialog claimed had been sealed off, with no way back except
 * Escape they had no reason to believe existed.
 *
 * This hook is the three things that make the promise true:
 *
 *   1. FOCUS MOVES IN. On open, the first focusable element in the dialog is
 *      focused. Without this a keyboard user's next Tab starts from wherever
 *      they were on the page, which is behind the overlay.
 *
 *   2. FOCUS STAYS IN. Tab from the last element wraps to the first, and
 *      Shift+Tab from the first wraps to the last. Computed on each keypress
 *      rather than cached, because a dialog's contents change — a search
 *      palette's result rows appear as you type, and a trap built once at open
 *      would be trapping a list that no longer exists.
 *
 *   3. FOCUS COMES BACK. On close, focus returns to whatever opened the dialog.
 *      Skipping this drops the user at the top of the document, which on a long
 *      page means finding their place again from scratch.
 *
 * Escape is deliberately NOT handled here. Some of these dialogs have unsaved
 * text in them and want to confirm before closing; a hook that dismissed them
 * unconditionally would be worse than no hook. `onEscape` is offered and each
 * caller decides.
 * ============================================================================
 */

/**
 * Everything that can hold focus, in document order.
 *
 * `:not([disabled])` and the negative-tabindex exclusion matter: a disabled
 * submit button at the end of a form is a common last element, and wrapping to
 * something that cannot take focus sends the browser back to the body — which
 * is the leak this exists to close.
 */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    /* `offsetParent === null` catches `display: none` and collapsed ancestors,
       which is most of what "present in the DOM but not really there" means in
       this codebase — responsive panels are hidden with `lg:hidden`. */
    (element) => element.offsetParent !== null || element === document.activeElement,
  );
}

export function useDialog(
  open: boolean,
  options: { onEscape?: () => void; autoFocus?: boolean } = {},
) {
  const ref = useRef<HTMLElement | null>(null);
  const { onEscape, autoFocus = true } = options;

  /* Whatever had focus before the dialog opened, so it can be given back. */
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const container = ref.current;
    if (!container) return;

    restoreTo.current = document.activeElement as HTMLElement | null;

    if (autoFocus) {
      /* The first focusable thing, or the container itself. A dialog with
         nothing focusable in it is still better anchored inside than out. */
      const first = focusableWithin(container)[0];
      if (first) first.focus();
      else {
        container.setAttribute("tabindex", "-1");
        container.focus();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && onEscape) {
        event.preventDefault();
        onEscape();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = focusableWithin(container!);
      if (focusable.length === 0) {
        /* Nothing to move to. Holding focus on the container is still inside
           the dialog, which is the whole contract. */
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      /* Focus outside the dialog entirely — a click on the page behind, or a
         browser quirk — is pulled back rather than left where it is. */
      if (!container!.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);

      /* Only if the element is still in the document — the thing that opened
         the dialog may itself have been removed by the action taken in it. */
      const target = restoreTo.current;
      if (target && document.contains(target)) target.focus();
    };
  }, [open, onEscape, autoFocus]);

  return ref;
}
