#!/usr/bin/env bash
# =============================================================================
# PUSH LOCAL ENVIRONMENT VALUES INTO VERCEL
# -----------------------------------------------------------------------------
#   ./scripts/env-push.sh              # ask about every variable
#   ./scripts/env-push.sh SOME_NAME    # just this one
#
# Reads .env.local, works out which Vercel environments each name belongs in,
# and adds it. The direction that matters day to day is the opposite one
# (`vercel env pull .env.local`); this exists for the first time a value is set
# and for the day a key is rotated.
#
# TWO RULES THIS SCRIPT KEEPS
#
#   1. A value is never printed. Not to the terminal, not to a log, not into an
#      argument list where `ps` would show it. Values reach `vercel` on stdin.
#      The script prints names and character counts and nothing else.
#   2. Nothing is overwritten silently. Answering `r` removes the existing value
#      first; anything else leaves it alone.
#
# WHERE THE ENVIRONMENT LIST COMES FROM
#
# .env.example is the source of truth. Each block there carries a
# `# env: production, preview` annotation that applies to the variables under
# it. That keeps one list rather than two that drift apart: adding a variable to
# .env.example is all it takes for this script to know about it.
#
# Written for bash 3.2, which is what macOS still ships, so there are no
# associative arrays here.
# =============================================================================

set -euo pipefail

cd "$(dirname "$0")/.."

EXAMPLE=".env.example"
LOCAL=".env.local"
ONLY="${1:-}"

fail() { printf '\n%s\n\n' "$1" >&2; exit 1; }

if ! command -v vercel >/dev/null 2>&1; then
  fail "The Vercel CLI is not installed. Install it with: pnpm add -g vercel"
fi

if [ ! -f "$EXAMPLE" ]; then fail "$EXAMPLE is missing. It is the list of what exists."; fi
if [ ! -f "$LOCAL" ]; then fail "$LOCAL is missing. Create it, or run: vercel env pull $LOCAL"; fi
if [ ! -d ".vercel" ]; then fail "This directory is not linked to a Vercel project. Run: vercel link"; fi
if [ ! -t 0 ] && [ ! -e /dev/tty ]; then fail "This script asks before every write, so it needs a terminal."; fi

# -----------------------------------------------------------------------------
# Which environments each name belongs in, read out of .env.example
# -----------------------------------------------------------------------------

MAP=""
current_envs=""

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    "# env:"*)
      # "# env:  production, preview" -> "production preview"
      current_envs=$(printf '%s' "$line" | sed 's/^# env:[[:space:]]*//; s/,/ /g')
      ;;
    *)
      # A variable, set or commented out. The index table at the top of
      # .env.example has no "=" on those lines, so it does not match.
      name=$(printf '%s' "$line" | sed -n 's/^#\{0,1\}[[:space:]]*\([A-Z_][A-Z0-9_]*\)=.*/\1/p')
      if [ -n "$name" ] && [ -n "$current_envs" ]; then
        MAP="${MAP}${name}	${current_envs}
"
      fi
      ;;
  esac
done < "$EXAMPLE"

environments_for() {
  printf '%s' "$MAP" | awk -F'\t' -v want="$1" '$1 == want { print $2; exit }'
}

# -----------------------------------------------------------------------------
# What is actually set locally
# -----------------------------------------------------------------------------

printf '\nPushing environment values into Vercel\n'
printf '%s\n' "----------------------------------------------------------------"

pushed=0
skipped=0
unknown=0

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ''|'#'*) continue ;;
  esac

  name="${line%%=*}"
  value="${line#*=}"

  # Not a NAME=VALUE line at all.
  case "$name" in
    ''|*[!A-Za-z0-9_]*) continue ;;
  esac

  if [ -n "$ONLY" ]; then
    if [ "$name" != "$ONLY" ]; then continue; fi
  fi

  if [ -z "$value" ]; then continue; fi

  # Strip one layer of surrounding quotes, which `vercel env pull` writes.
  case "$value" in
    \"*\") value="${value#\"}"; value="${value%\"}" ;;
    \'*\') value="${value#\'}"; value="${value%\'}" ;;
  esac

  targets=$(environments_for "$name")

  if [ -z "$targets" ]; then
    printf '  ?? %-34s not in %s. Document it there first.\n' "$name" "$EXAMPLE"
    unknown=$((unknown + 1))
    continue
  fi

  for target in $targets; do
    # "development" in .env.example means a developer's own file, not a Vercel
    # environment that ships anything. Those are never pushed.
    if [ "$target" = "development" ]; then continue; fi

    printf '  -- %-34s -> %-11s (%d characters)\n' "$name" "$target" "${#value}"
    printf '     push it? [y = add / r = replace existing / anything else = skip] '
    read -r answer < /dev/tty || answer=""

    case "$answer" in
      r|R)
        vercel env rm "$name" "$target" --yes >/dev/null 2>&1 || true
        ;;
      y|Y)
        ;;
      *)
        printf '     skipped\n'
        skipped=$((skipped + 1))
        continue
        ;;
    esac

    # The value goes over stdin. It never appears in the argument list, so it
    # never reaches `ps`, a shell history or a CI log.
    if printf '%s' "$value" | vercel env add "$name" "$target" >/dev/null 2>&1; then
      printf '     ok\n'
      pushed=$((pushed + 1))
    else
      printf '     FAILED. It probably already exists; run again and answer r.\n'
      skipped=$((skipped + 1))
    fi
  done
done < "$LOCAL"

printf '%s\n' "----------------------------------------------------------------"
printf 'pushed %d, skipped %d, undocumented %d\n\n' "$pushed" "$skipped" "$unknown"

if [ "$unknown" -gt 0 ]; then
  printf 'Undocumented names were not pushed. Add them to %s with an\n' "$EXAMPLE"
  printf '"# env:" annotation above them, then run this again.\n\n'
fi

printf 'A changed environment variable does not reach the running site until the\n'
printf 'next deployment. Push a commit, or run: vercel redeploy\n\n'
