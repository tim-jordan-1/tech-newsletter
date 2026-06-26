#!/usr/bin/env bash
# Setup script for tech-newsletter.
# Run from the project root: bash scripts/setup.sh

set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

info()    { echo -e "${BOLD}$*${RESET}"; }
success() { echo -e "${GREEN}✔ $*${RESET}"; }
warn()    { echo -e "${YELLOW}⚠  $*${RESET}"; }
error()   { echo -e "${RED}✖ $*${RESET}" >&2; exit 1; }
step()    { echo; echo -e "${BOLD}── $* ──${RESET}"; }

# ── Change to project root ──────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo
info "Tech Newsletter — Setup"
echo "Project root: $PROJECT_ROOT"

# ── Node.js ──────────────────────────────────────────────────────────────────

step "Checking Node.js"

if ! command -v node &>/dev/null; then
  error "Node.js not found. Install Node.js 20+ from https://nodejs.org and re-run this script."
fi

NODE_VERSION=$(node --version | sed 's/v//')
NODE_MAJOR="${NODE_VERSION%%.*}"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  error "Node.js $NODE_VERSION found but 20+ is required. Upgrade from https://nodejs.org."
fi
success "Node.js $NODE_VERSION"

# ── npm install ──────────────────────────────────────────────────────────────

step "Installing Node.js dependencies"
npm install
success "npm install complete"

# ── Python (optional, for --with-notebooklm) ─────────────────────────────────

step "Checking Python (optional — needed for --with-notebooklm)"

PYTHON_OK=false
if command -v python3 &>/dev/null; then
  PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
  PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)
  PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
  if [[ "$PYTHON_MAJOR" -ge 3 && "$PYTHON_MINOR" -ge 10 ]]; then
    success "Python $PYTHON_VERSION"
    PYTHON_OK=true
  else
    warn "Python $PYTHON_VERSION found but 3.10+ is required for --with-notebooklm. Skipping Python setup."
  fi
else
  warn "python3 not found. Install Python 3.10+ if you want to use --with-notebooklm."
fi

if [[ "$PYTHON_OK" == true ]]; then
  info "Installing Python dependencies..."
  python3 -m pip install -r requirements.txt --quiet
  success "Python dependencies installed (notebooklm-py)"
fi

# ── .env ─────────────────────────────────────────────────────────────────────

step "Configuring secrets (.env)"

if [[ -f .env ]]; then
  success ".env already exists — skipping"
else
  cp .env.example .env
  success ".env created from .env.example"
  echo "  Edit .env and fill in the values described below."
fi

# ── Secrets guide ─────────────────────────────────────────────────────────────

step "Required secrets"

cat <<'GUIDE'

Fill in these values in .env:

  TWITTER_COOKIES
    Log into x.com → DevTools → Application → Cookies → x.com
    Export as JSON array and paste the value.

  TELEGRAM_BOT_TOKEN
    Message @BotFather on Telegram → /newbot → follow prompts → copy token.

  TELEGRAM_CHAT_IDS
    Start a chat with your bot, then visit:
      https://api.telegram.org/bot<TOKEN>/getUpdates
    Find "chat": {"id": ...} and set as a JSON array: ["123456789"]

  GITHUB_MODELS_TOKEN
    GitHub → Settings → Developer settings → Fine-grained tokens
    Permissions → Account permissions → Models → Read-only
    Paste the generated token.

GUIDE

# ── NotebookLM auth (optional) ────────────────────────────────────────────────

if [[ "$PYTHON_OK" == true ]]; then
  step "NotebookLM authentication (optional)"
  echo "  To use --with-notebooklm you need to authenticate with Google once."
  echo
  read -r -p "  Set up NotebookLM auth now? [y/N] " SETUP_NLM
  echo
  if [[ "$SETUP_NLM" =~ ^[Yy]$ ]]; then
    info "Running: python3 -m notebooklm login"
    python3 -m notebooklm login
    echo
    if [[ -f "$HOME/.notebooklm/profiles/default/storage_state.json" ]]; then
      info "Adding NOTEBOOKLM_AUTH_JSON to .env..."
      # Remove existing entry if present, then append fresh value
      grep -v '^NOTEBOOKLM_AUTH_JSON=' .env > .env.tmp && mv .env.tmp .env || true
      printf 'NOTEBOOKLM_AUTH_JSON=%s\n' "$(cat "$HOME/.notebooklm/profiles/default/storage_state.json")" >> .env
      success "NOTEBOOKLM_AUTH_JSON written to .env"
    else
      warn "Login may have failed — ~/.notebooklm/profiles/default/storage_state.json not found."
      warn "Re-run 'python3 -m notebooklm login' manually."
    fi
  else
    echo "  Skipped. When ready, run:"
    echo "    python3 -m notebooklm login"
    echo "    echo \"NOTEBOOKLM_AUTH_JSON=\$(cat ~/.notebooklm/profiles/default/storage_state.json)\" >> .env"
  fi
fi

# ── Claude Code Routine ────────────────────────────────────────────────────────

step "Claude Code Routine (remote execution)"

cat <<'ROUTINE'

To automate the newsletter daily via Claude Code:

1. Create a routine at claude.ai/code (or in the Claude Code app):
     Trigger    : Daily cron — 7:30 AM AEST (Australia/Sydney)
     Repository : tim-jordan-1/tech-newsletter
     Prompt     : Run npm install && python3 -m pip install -r requirements.txt && npm run generate -- --with-notebooklm

   Omit "--with-notebooklm" and the pip install if you don't need audio.

2. Add these secrets to the routine environment:
     TWITTER_COOKIES
     TELEGRAM_BOT_TOKEN
     TELEGRAM_CHAT_IDS
     GITHUB_MODELS_TOKEN
     NOTEBOOKLM_AUTH_JSON   (optional — only for --with-notebooklm)

   NOTEBOOKLM_AUTH_JSON: run this locally after login and paste the output:
     cat ~/.notebooklm/profiles/default/storage_state.json

3. Configure network access — either enable unrestricted access, or add these
   domains to the allowlist:
     x.com / twitter.com                  (tweet scraping)
     models.inference.ai.azure.com        (GitHub Models / GPT-4o-mini)
     api.telegram.org                     (Telegram delivery)
     notebooklm.google.com                (required for --with-notebooklm)

ROUTINE

# ── Done ──────────────────────────────────────────────────────────────────────

echo
success "Setup complete!"
echo
echo "  npm run generate -- --no-send    # test the pipeline locally (no Telegram)"
echo "  npm run generate -- --preview    # open generated HTML in browser"
echo "  npm run generate                 # full run (Telegram delivery)"
echo "  npm run generate -- --with-notebooklm  # + NotebookLM audio"
echo "  npm test                         # run Node.js tests"
[[ "$PYTHON_OK" == true ]] && echo "  python3 -m pytest scripts/          # run Python tests"
echo
