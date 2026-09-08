#!/usr/bin/env bash
# =============================================================================
# ONE COMMAND ON A NEW MACHINE
# -----------------------------------------------------------------------------
#   ./scripts/bootstrap.sh
#
# Takes a fresh clone to a running development environment, and takes a machine
# that has done this before to exactly the same place. Idempotent: run it as
# often as you like.
#
# The order matters and is not arbitrary:
#
#   1. Node          the runtime the rest of it needs
#   2. pnpm          via corepack, at the version package.json pins
#   3. install       dependencies, frozen to the lockfile
#   4. gh            report auth, because cloning was already the proof
#   5. vercel link   attach this directory to the hosted project
#   6. vercel env    pull the real values, which is where secrets come from
#   7. pnpm setup    Playwright browsers and a fallback .env.local
#   8. supabase link so migrations can be pushed from here
#
# Steps 4 to 8 are best effort. The product runs with no configuration at all,
# so a machine with none of those CLIs still ends up with a working dev server;
# it just cannot deploy or push migrations, and the script says so rather than
# failing.
#
# NOTHING HERE OVERWRITES YOUR .env.local WITHOUT ASKING. If one exists, the
# script asks before pulling over it and copies it aside first.
# =============================================================================

set -uo pipefail

cd "$(dirname "$0")/.."

BOLD=""; DIM=""; RESET=""
if [ -t 1 ]; then BOLD="$(printf '\033[1m')"; DIM="$(printf '\033[2m')"; RESET="$(printf '\033[0m')"; fi

step()  { printf '\n%s==>%s %s%s%s\n' "$DIM" "$RESET" "$BOLD" "$1" "$RESET"; }
ok()    { printf '    ok   %s\n' "$1"; }
note()  { printf '    --   %s\n' "$1"; }
warn()  { printf '    !!   %s\n' "$1"; }
hint()  { printf '         %s\n' "$1"; }

problems=0
have() { command -v "$1" >/dev/null 2>&1; }

printf '\n%sStudentOS bootstrap%s\n' "$BOLD" "$RESET"
printf '%s\n' "================================================================"

# -----------------------------------------------------------------------------
step "1. Node"
# -----------------------------------------------------------------------------

if ! have node; then
  warn "Node is not installed."
  hint "Install the version in .nvmrc:  https://github.com/Schniz/fnm"
  hint "  fnm install && fnm use     (or: nvm install && nvm use)"
  exit 1
fi

wanted=$(tr -d ' \r\n' < .nvmrc 2>/dev/null || echo "")
actual=$(node -p 'process.versions.node.split(".")[0]')

if [ -n "$wanted" ] && [ "$actual" -lt "$wanted" ]; then
  warn "Node $actual is too old. This project needs $wanted."
  hint "fnm install $wanted && fnm use $wanted     (or the nvm equivalent)"
  hint "Older runtimes have no --experimental-strip-types, so pnpm test cannot run."
  exit 1
fi
ok "Node $(node -v)"

# -----------------------------------------------------------------------------
step "2. pnpm"
# -----------------------------------------------------------------------------

if ! have pnpm; then
  if have corepack; then
    note "pnpm not found, enabling corepack"
    corepack enable >/dev/null 2>&1 || true
  fi
fi

if ! have pnpm; then
  warn "pnpm is still not available."
  hint "corepack enable       (bundled with Node, activates the pinned version)"
  hint "npm install -g pnpm   (if corepack is unavailable on this machine)"
  exit 1
fi
ok "pnpm $(pnpm -v)"

# -----------------------------------------------------------------------------
step "3. Dependencies"
# -----------------------------------------------------------------------------

if pnpm install --frozen-lockfile; then
  ok "installed from the lockfile"
else
  warn "pnpm install failed."
  hint "If it complains the lockfile is out of date, someone committed a"
  hint "package.json change without the lockfile. Run: pnpm install"
  exit 1
fi

# -----------------------------------------------------------------------------
step "4. GitHub"
# -----------------------------------------------------------------------------

if ! have gh; then
  note "The GitHub CLI is not installed. Not required to develop."
  hint "https://cli.github.com"
elif gh auth status >/dev/null 2>&1; then
  ok "gh is authenticated as $(gh api user --jq .login 2>/dev/null || echo 'an account')"
else
  warn "gh is installed but not signed in."
  hint "gh auth login"
  problems=$((problems + 1))
fi

# -----------------------------------------------------------------------------
step "5. Vercel project"
# -----------------------------------------------------------------------------

vercel_ready=0

if ! have vercel; then
  note "The Vercel CLI is not installed, so secrets cannot be pulled."
  hint "pnpm add -g vercel   then run this script again"
elif ! vercel whoami >/dev/null 2>&1; then
  warn "The Vercel CLI is not signed in."
  hint "vercel login"
  problems=$((problems + 1))
elif [ -d ".vercel" ]; then
  ok "already linked to a Vercel project"
  vercel_ready=1
elif vercel link --yes >/dev/null 2>&1; then
  ok "linked to the Vercel project"
  vercel_ready=1
else
  warn "vercel link failed. It usually means the project name did not match."
  hint "vercel link           and pick the project interactively"
  problems=$((problems + 1))
fi

# -----------------------------------------------------------------------------
step "6. Environment values"
# -----------------------------------------------------------------------------

pull_env() {
  if vercel env pull .env.local --yes >/dev/null 2>&1; then
    ok "pulled .env.local from Vercel"
  else
    warn "vercel env pull failed."
    hint "vercel env pull .env.local"
    problems=$((problems + 1))
  fi
}

if [ "$vercel_ready" -eq 0 ]; then
  note "skipped, no linked Vercel project"
elif [ ! -f .env.local ]; then
  pull_env
else
  printf '    ??   .env.local already exists. Replace it from Vercel? [y/N] '
  if [ -e /dev/tty ]; then read -r answer < /dev/tty || answer=""; else answer=""; fi
  case "$answer" in
    y|Y)
      cp .env.local ".env.local.backup-$(date +%Y%m%d-%H%M%S)"
      ok "copied the old one aside as .env.local.backup-*"
      pull_env
      ;;
    *)
      note "kept your existing .env.local"
      hint "To replace it later:  vercel env pull .env.local"
      ;;
  esac
fi

# -----------------------------------------------------------------------------
step "7. Local setup"
# -----------------------------------------------------------------------------

# Writes a fallback .env.local if there still is not one, fetches the Playwright
# browsers, and prints which services are connected and what each absence costs.
node scripts/setup.mjs || problems=$((problems + 1))

# -----------------------------------------------------------------------------
step "8. Supabase"
# -----------------------------------------------------------------------------

project_ref=""
if [ -f .env.local ]; then
  # Strip quotes (octal 042 and 047), spaces and a Windows carriage return.
  project_ref=$(sed -n 's/^SUPABASE_PROJECT_REF=//p' .env.local | tr -d '\042\047 \r' | head -1)
  if [ -z "$project_ref" ]; then
    # Fall back to the ref embedded in the project URL.
    project_ref=$(sed -n 's#^NEXT_PUBLIC_SUPABASE_URL=.*https://\([a-z0-9-]*\)\.supabase\.co.*#\1#p' .env.local | head -1)
  fi
fi

if ! have supabase; then
  note "The Supabase CLI is not installed. Not required to develop."
  hint "https://supabase.com/docs/guides/local-development/cli/getting-started"
elif [ -z "$project_ref" ]; then
  note "No SUPABASE_PROJECT_REF in .env.local, so nothing to link."
  hint "That is the normal state before a hosted project exists."
elif [ -f supabase/.temp/project-ref ] && [ "$(cat supabase/.temp/project-ref)" = "$project_ref" ]; then
  ok "already linked to $project_ref"
elif supabase link --project-ref "$project_ref" >/dev/null 2>&1; then
  ok "linked to $project_ref"
else
  warn "supabase link failed."
  hint "supabase login   then:  supabase link --project-ref $project_ref"
  problems=$((problems + 1))
fi

# -----------------------------------------------------------------------------

printf '\n%s\n' "================================================================"
if [ "$problems" -eq 0 ]; then
  printf '%sReady.%s Run  %spnpm dev%s\n\n' "$BOLD" "$RESET" "$BOLD" "$RESET"
else
  printf '%sReady, with %d thing(s) flagged above.%s\n' "$BOLD" "$problems" "$RESET"
  printf 'None of them stop the dev server. Run  %spnpm dev%s\n\n' "$BOLD" "$RESET"
fi
