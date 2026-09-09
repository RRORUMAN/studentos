"use client";

import { CornerDownLeft, Search, Sparkles } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { searchDestinations } from "@/domain/command";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * QUICK COMMAND
 * ----------------------------------------------------------------------------
 * One field that reaches every screen, and hands anything it does not
 * recognise to Ask.
 *
 * WHY IT EXISTS. The navigation bar holds five things and the product has
 * forty screens. The other thirty-five are reachable from Home and from their
 * own section, which is fine when you know the product and useless at the
 * moment you need them -- a student holding a form with "empadronamiento" on
 * it does not know that lives under Arrival. Typing the word they are looking
 * at should be enough.
 *
 * THE LAST ROW IS THE IMPORTANT ONE. Anything the registry does not match
 * becomes "Ask StudentOS", carrying the query through to /ask. So the palette
 * has no dead end: a question typed into it is still a question, and the
 * student never has to learn which words the product knows. It is also the
 * honest design -- rather than fuzzy-matching "cheapest gym near me" onto some
 * screen that half fits, it passes it to the thing that can actually answer.
 *
 * SEARCHES DESTINATIONS, NOT CONTENT. It does not search your plans, your
 * messages or the places in the city; nothing here pretends to. Those have
 * their own search, and a palette that silently returned three of your
 * messages and none of the other eleven would be worse than one that says what
 * it does.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* The shortcut hint                                                           */
/* -------------------------------------------------------------------------- */

/**
 * `⌘K` on a Mac, `CtrlK` everywhere else, and NOTHING on the server.
 *
 * Through `useSyncExternalStore` rather than an effect, because the server
 * does not know the platform and rendering the wrong glyph first is a
 * hydration mismatch. The server snapshot is null, so the badge simply is not
 * there until the browser can answer; the button works the whole time either
 * way. Nothing ever changes it, so the subscribe function has nothing to do.
 */
const noSubscribe = () => () => {};

function readModifier(): string {
  const nav = globalThis.navigator;
  const hint = `${nav?.platform ?? ""} ${nav?.userAgent ?? ""}`;
  return /mac|iphone|ipad/i.test(hint) ? "⌘" : "Ctrl";
}

export function QuickCommand() {
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const modifier = useSyncExternalStore(noSubscribe, readModifier, () => null);

  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchDestinations(query), [query]);

  /* The Ask row exists only once something has been typed. With an empty
     field there is no question to pass on. */
  const asking = query.trim().length > 0;
  const rowCount = results.length + (asking ? 1 : 0);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  const go = useCallback(
    (index: number) => {
      const destination = results[index]?.destination;
      close();
      if (destination) router.push(destination.href);
      else if (asking) router.push(`/ask?q=${encodeURIComponent(query.trim())}`);
    },
    [asking, close, query, results, router],
  );

  /* Cmd+K anywhere. Deliberately not "/" as well: this product has a lot of
     text fields and a shortcut that steals a slash from someone typing a URL
     into a post is a bug that is hard to report. */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((was) => !was);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  /**
   * A route change closes the panel.
   *
   * `go` already closes before pushing, so this only catches the other ways a
   * route can change underneath an open palette: the browser's back button,
   * and a link somewhere else on the page. Written as a render-time
   * adjustment against the last pathname rather than as an effect, because an
   * effect that calls `setState` renders the stale panel once first.
   */
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (open) {
      setOpen(false);
      setQuery("");
      setActive(0);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search StudentOS"
        aria-keyshortcuts="Meta+K Control+K"
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full text-ink-500 transition-colors",
          "hover:bg-ink-100 hover:text-ink-950",
          "lg:h-10 lg:w-auto lg:gap-2 lg:rounded-full lg:px-3.5 lg:ring-1 lg:ring-ink-950/8",
          "lg:flex lg:items-center",
        )}
      >
        <Search className="size-5 lg:size-4" strokeWidth={1.9} />
        <span className="hidden text-[0.875rem] text-ink-400 lg:inline">Search</span>
        {modifier ? (
          <span
            aria-hidden
            className="hidden rounded border border-ink-200 px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink-400 lg:inline"
          >
            {modifier}K
          </span>
        ) : null}
      </button>

      {/* z-60 for the same reason the composer uses it: the bottom navigation
          is z-50 and paints over anything below it. */}
      {open ? (
        <div className="fixed inset-0 z-60" role="dialog" aria-modal="true" aria-label="Search StudentOS">
          <button
            type="button"
            aria-label="Close search"
            onClick={close}
            className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]"
          />

          <div
            className={cn(
              "absolute inset-x-3 top-[8vh] mx-auto max-w-lg overflow-hidden rounded-2xl bg-white",
              "shadow-[var(--shadow-lift)] ring-1 ring-ink-950/8",
            )}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                close();
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((index) => (rowCount === 0 ? 0 : (index + 1) % rowCount));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((index) => (rowCount === 0 ? 0 : (index - 1 + rowCount) % rowCount));
              } else if (event.key === "Enter") {
                event.preventDefault();
                go(active);
              }
            }}
          >
            <div className="flex items-center gap-3 border-b border-ink-200/70 px-4">
              <Search className="size-4 shrink-0 text-ink-400" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  /* Every keystroke re-ranks the list, so the highlight goes
                     back to the top. In the handler rather than an effect: it
                     is caused by the typing, not by the state. */
                  setActive(0);
                }}
                placeholder="Go anywhere, or ask anything"
                aria-label="Search"
                role="combobox"
                aria-expanded="true"
                aria-controls="quick-command-list"
                aria-activedescendant={`quick-command-row-${active}`}
                autoComplete="off"
                className="h-13 w-full bg-transparent text-[0.9375rem] text-ink-900 outline-none placeholder:text-ink-400"
              />
            </div>

            <ul id="quick-command-list" role="listbox" aria-label="Results" className="max-h-[52vh] overflow-y-auto p-1.5">
              {results.map((result, index) => (
                <li
                  key={result.destination.href}
                  id={`quick-command-row-${index}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(index)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5",
                    index === active ? "bg-ink-100" : "",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] font-medium text-ink-950">
                      {result.destination.label}
                    </p>
                    <p className="truncate text-[0.8125rem] text-ink-500">
                      {result.destination.hint}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-micro uppercase tracking-[0.1em] text-ink-400">
                    {result.destination.group}
                  </span>
                  {index === active ? (
                    <CornerDownLeft className="size-3.5 shrink-0 text-ink-400" aria-hidden />
                  ) : null}
                </li>
              ))}

              {asking ? (
                <li
                  id={`quick-command-row-${results.length}`}
                  role="option"
                  aria-selected={results.length === active}
                  onMouseEnter={() => setActive(results.length)}
                  onClick={() => go(results.length)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5",
                    results.length === active ? "bg-ink-100" : "",
                  )}
                >
                  <Sparkles className="size-4 shrink-0 text-signal-deep" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] font-medium text-ink-950">
                      Ask &ldquo;{query.trim()}&rdquo;
                    </p>
                    <p className="truncate text-[0.8125rem] text-ink-500">
                      {results.length === 0
                        ? "Nothing here is called that. Ask instead."
                        : "Or put the question to StudentOS"}
                    </p>
                  </div>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
