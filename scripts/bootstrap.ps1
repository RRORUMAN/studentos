# =============================================================================
# ONE COMMAND ON A NEW MACHINE (Windows PowerShell)
# -----------------------------------------------------------------------------
#   ./scripts/bootstrap.ps1
#
# The same eight steps as scripts/bootstrap.sh, for a Windows machine without
# Git Bash. If you have Git Bash, either works and they do the same thing.
#
# If PowerShell refuses to run it, that is the execution policy, not the script:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#
# Idempotent. Nothing here overwrites your .env.local without asking.
# =============================================================================

$ErrorActionPreference = 'Continue'
Set-Location (Join-Path $PSScriptRoot '..')

$problems = 0

function Step($text) { Write-Host ''; Write-Host "==> $text" -ForegroundColor Cyan }
function Ok($text)   { Write-Host "    ok   $text" }
function Note($text) { Write-Host "    --   $text" }
function Warn($text) { Write-Host "    !!   $text" -ForegroundColor Yellow }
function Hint($text) { Write-Host "         $text" -ForegroundColor DarkGray }
function Have($name) { $null -ne (Get-Command $name -ErrorAction SilentlyContinue) }

Write-Host ''
Write-Host 'StudentOS bootstrap' -ForegroundColor White
Write-Host '================================================================'

# -----------------------------------------------------------------------------
Step '1. Node'
# -----------------------------------------------------------------------------

if (-not (Have 'node')) {
  Warn 'Node is not installed.'
  Hint 'Install the version in .nvmrc:  https://github.com/Schniz/fnm'
  Hint '  fnm install; fnm use'
  exit 1
}

$wanted = if (Test-Path '.nvmrc') { (Get-Content '.nvmrc' -Raw).Trim() } else { '' }
$actual = [int](node -p 'process.versions.node.split(".")[0]')

if ($wanted -and $actual -lt [int]$wanted) {
  Warn "Node $actual is too old. This project needs $wanted."
  Hint "fnm install $wanted; fnm use $wanted"
  Hint 'Older runtimes have no --experimental-strip-types, so pnpm test cannot run.'
  exit 1
}
Ok "Node $(node -v)"

# -----------------------------------------------------------------------------
Step '2. pnpm'
# -----------------------------------------------------------------------------

if (-not (Have 'pnpm')) {
  if (Have 'corepack') {
    Note 'pnpm not found, enabling corepack'
    corepack enable 2>&1 | Out-Null
  }
}

if (-not (Have 'pnpm')) {
  Warn 'pnpm is still not available.'
  Hint 'corepack enable       (bundled with Node, activates the pinned version)'
  Hint 'npm install -g pnpm   (if corepack is unavailable on this machine)'
  exit 1
}
Ok "pnpm $(pnpm -v)"

# -----------------------------------------------------------------------------
Step '3. Dependencies'
# -----------------------------------------------------------------------------

pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) {
  Warn 'pnpm install failed.'
  Hint 'If it says the lockfile is out of date, someone committed a package.json'
  Hint 'change without the lockfile. Run: pnpm install'
  exit 1
}
Ok 'installed from the lockfile'

# -----------------------------------------------------------------------------
Step '4. GitHub'
# -----------------------------------------------------------------------------

if (-not (Have 'gh')) {
  Note 'The GitHub CLI is not installed. Not required to develop.'
  Hint 'https://cli.github.com'
} else {
  gh auth status 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Ok 'gh is authenticated'
  } else {
    Warn 'gh is installed but not signed in.'
    Hint 'gh auth login'
    $problems++
  }
}

# -----------------------------------------------------------------------------
Step '5. Vercel project'
# -----------------------------------------------------------------------------

$vercelReady = $false

if (-not (Have 'vercel')) {
  Note 'The Vercel CLI is not installed, so secrets cannot be pulled.'
  Hint 'pnpm add -g vercel   then run this script again'
} else {
  vercel whoami 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Warn 'The Vercel CLI is not signed in.'
    Hint 'vercel login'
    $problems++
  } elseif (Test-Path '.vercel') {
    Ok 'already linked to a Vercel project'
    $vercelReady = $true
  } else {
    vercel link --yes 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Ok 'linked to the Vercel project'
      $vercelReady = $true
    } else {
      Warn 'vercel link failed. It usually means the project name did not match.'
      Hint 'vercel link           and pick the project interactively'
      $problems++
    }
  }
}

# -----------------------------------------------------------------------------
Step '6. Environment values'
# -----------------------------------------------------------------------------

function Pull-Env {
  vercel env pull .env.local --yes 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Ok 'pulled .env.local from Vercel'
  } else {
    Warn 'vercel env pull failed.'
    Hint 'vercel env pull .env.local'
    $script:problems++
  }
}

if (-not $vercelReady) {
  Note 'skipped, no linked Vercel project'
} elseif (-not (Test-Path '.env.local')) {
  Pull-Env
} else {
  $answer = Read-Host '    ??   .env.local already exists. Replace it from Vercel? [y/N]'
  if ($answer -match '^[Yy]') {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    Copy-Item '.env.local' ".env.local.backup-$stamp"
    Ok "copied the old one aside as .env.local.backup-$stamp"
    Pull-Env
  } else {
    Note 'kept your existing .env.local'
    Hint 'To replace it later:  vercel env pull .env.local'
  }
}

# -----------------------------------------------------------------------------
Step '7. Local setup'
# -----------------------------------------------------------------------------

# Writes a fallback .env.local if there still is not one, fetches the Playwright
# browsers, and prints which services are connected and what each absence costs.
node scripts/setup.mjs
if ($LASTEXITCODE -ne 0) { $problems++ }

# -----------------------------------------------------------------------------
Step '8. Supabase'
# -----------------------------------------------------------------------------

$projectRef = ''
if (Test-Path '.env.local') {
  $lines = Get-Content '.env.local'
  $direct = $lines | Where-Object { $_ -match '^SUPABASE_PROJECT_REF=(.+)$' } | Select-Object -First 1
  if ($direct -and $direct -match '^SUPABASE_PROJECT_REF=(.+)$') {
    $projectRef = $Matches[1].Trim().Trim('"').Trim("'")
  }
  if (-not $projectRef) {
    $url = $lines | Where-Object { $_ -match '^NEXT_PUBLIC_SUPABASE_URL=' } | Select-Object -First 1
    if ($url -and $url -match 'https://([a-z0-9-]+)\.supabase\.co') { $projectRef = $Matches[1] }
  }
}

if (-not (Have 'supabase')) {
  Note 'The Supabase CLI is not installed. Not required to develop.'
  Hint 'https://supabase.com/docs/guides/local-development/cli/getting-started'
} elseif (-not $projectRef) {
  Note 'No SUPABASE_PROJECT_REF in .env.local, so nothing to link.'
  Hint 'That is the normal state before a hosted project exists.'
} else {
  $linkedFile = 'supabase/.temp/project-ref'
  if ((Test-Path $linkedFile) -and ((Get-Content $linkedFile -Raw).Trim() -eq $projectRef)) {
    Ok "already linked to $projectRef"
  } else {
    supabase link --project-ref $projectRef 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Ok "linked to $projectRef"
    } else {
      Warn 'supabase link failed.'
      Hint "supabase login   then:  supabase link --project-ref $projectRef"
      $problems++
    }
  }
}

# -----------------------------------------------------------------------------

Write-Host ''
Write-Host '================================================================'
if ($problems -eq 0) {
  Write-Host 'Ready. Run  pnpm dev' -ForegroundColor Green
} else {
  Write-Host "Ready, with $problems thing(s) flagged above." -ForegroundColor Yellow
  Write-Host 'None of them stop the dev server. Run  pnpm dev'
}
Write-Host ''
