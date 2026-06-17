# Tech Newsletter

Automated tech newsletter pipeline that scrapes Twitter/X, summarizes with AI, and delivers via Telegram.

## How it works

1. **Scrape** — Fetches recent tweets from a curated list of accounts and keyword searches using your authenticated Twitter session
2. **Summarize** — Groups tweets by keyword into categories, then calls GPT-4o-mini (via GitHub Models) to write newsletter-style summaries and a TL;DR
3. **Render** — Produces a styled HTML newsletter saved to `output/`
4. **NotebookLM** *(optional, `--with-notebooklm`)* — Creates a Google NotebookLM notebook with the newsletter content and triggers a Brief audio overview
5. **Deliver** — Sends a formatted message + the HTML file to your Telegram chat

## Prerequisites

- Node.js 20+
- npm
- Python 3.10+ *(only required for `--with-notebooklm`)*

## Setup

### Quick setup (recommended)

Run the interactive setup script — it installs dependencies, creates `.env`, and guides you through each credential:

```bash
bash scripts/setup.sh
```

Or follow the manual steps below.

### 1. Install dependencies

```bash
npm install
```

### 2. Configure secrets

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `TWITTER_COOKIES` | Yes | JSON array of Twitter/X session cookies (exported from browser DevTools) |
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram bot token from [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_CHAT_IDS` | Yes | JSON array of Telegram chat IDs, e.g. `["123456789"]` |
| `GITHUB_MODELS_TOKEN` | Yes | GitHub fine-grained PAT with `models:read` scope |
| `NOTEBOOKLM_AUTH_JSON` | `--with-notebooklm` only | Content of `~/.notebooklm/storage_state.json` after login |

### 3. Get Twitter cookies

The scraper uses your existing Twitter session — no API key required.

1. Log into [x.com](https://x.com) in Chrome or Firefox
2. Open DevTools → Application → Cookies → `https://x.com`
3. Export all cookies as a JSON array and paste into `.env`:

```env
TWITTER_COOKIES=[{"name":"auth_token","value":"...","domain":".x.com"},...]
```

> Use a secondary account if possible — automated scraping can trigger account flags.

### 4. Set up a Telegram bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts to create a bot
3. Copy the bot token into `.env` as `TELEGRAM_BOT_TOKEN`
4. Start a chat with your bot (or add it to a group/channel)
5. Get your chat ID by visiting `https://api.telegram.org/bot<TOKEN>/getUpdates` after sending a message
6. Add the chat ID to `config.json`:

```json
"telegram": {
  "chatIds": ["123456789"]
}
```

### 5. Set up NotebookLM (optional)

This step is only needed for `--with-notebooklm`. Skip it if you don't plan to use that flag.

The pipeline uses `notebooklm-py` to create a NotebookLM notebook and trigger a Brief audio overview after each newsletter generation.

**Install the Python dependency:**

```bash
python3 -m pip install -r requirements.txt
```

**Authenticate with Google:**

```bash
python3 -m notebooklm login
```

This opens a browser to complete Google OAuth and saves the session to `~/.notebooklm/storage_state.json`.

**Export the session to `.env`:**

```bash
echo "NOTEBOOKLM_AUTH_JSON=$(cat ~/.notebooklm/storage_state.json)" >> .env
```

> The session token is tied to the Google account you logged in with. NotebookLM notebooks will appear in that account at [notebooklm.google.com](https://notebooklm.google.com).

### 6. Create a GitHub Models token

1. Go to **GitHub Settings → Developer settings → Fine-grained personal access tokens** ([direct link](https://github.com/settings/tokens?type=beta))
2. Click **Generate new token**
3. Name it (e.g., `tech-newsletter`)
4. Set an expiration date (max 1 year)
5. Under **Permissions → Account permissions**, set **Models** to **Read-only**
6. Click **Generate token** and paste the value into `.env` as `GITHUB_MODELS_TOKEN`

> Named `GITHUB_MODELS_TOKEN` (not `GITHUB_TOKEN`) to avoid collision with the automatic `GITHUB_TOKEN` in GitHub Actions, which lacks `models:read` scope.

### 7. Customize accounts and keywords

Edit `config.json`:

```json
{
  "twitter": {
    "accounts": ["AnthropicAI", "ThePrimeagen", "levelsio"],
    "keywords": ["AI", "typescript", "web development"],
    "maxTweetsPerAccount": 20,
    "maxTweetsPerKeyword": 30
  },
  "newsletter": {
    "title": "Tech Newsletter",
    "maxAge": "24h"
  }
}
```

`maxAge` controls how far back to look — `"24h"` means only tweets from the last 24 hours.

## Commands

```bash
# Run the full pipeline (scrape → summarize → render → send)
npm run generate

# Skip Telegram delivery
npm run generate -- --no-send

# Open generated HTML in browser after rendering
npm run generate -- --preview

# Also create a NotebookLM notebook with Brief audio (requires NOTEBOOKLM_AUTH_JSON)
npm run generate -- --with-notebooklm

# Run all tests
npm test

# Run Python tests
python3 -m pytest scripts/
```

## Claude Code Routine (daily automation)

To run the pipeline daily on Anthropic cloud infrastructure:

1. Create a Claude Code Routine with:
   - **Trigger:** Daily cron at 8:00 AM AEST (`Australia/Sydney`)
   - **Repository:** `tim-jordan-1/tech-newsletter`
   - **Prompt:** `Run npm install && python3 -m pip install -r requirements.txt && npm run generate -- --with-notebooklm to scrape tweets, summarize, send the newsletter via Telegram, and create a NotebookLM audio overview.`

   > Omit `--with-notebooklm` and the `pip install` step if you don't need the audio feature.

2. Configure these secrets in the routine environment:

   | Secret | Notes |
   |---|---|
   | `TWITTER_COOKIES` | JSON array of Twitter cookies |
   | `TELEGRAM_BOT_TOKEN` | Telegram bot token |
   | `TELEGRAM_CHAT_IDS` | JSON array of chat IDs, e.g. `["123456789"]` |
   | `GITHUB_MODELS_TOKEN` | GitHub PAT with `models:read` scope |
   | `NOTEBOOKLM_AUTH_JSON` | Content of `~/.notebooklm/storage_state.json` — only needed with `--with-notebooklm` |

3. Configure **network access** — the pipeline calls several external services:
   - Enable unrestricted network access, **or** add these domains to the allowlist:
     - `x.com` / `twitter.com` (scraping)
     - `models.inference.ai.azure.com` (GitHub Models API)
     - `api.telegram.org` (Telegram delivery)
     - `notebooklm.google.com` (required for `--with-notebooklm` — omit if not using that flag)

### Getting `NOTEBOOKLM_AUTH_JSON` for the routine

Run this locally after completing the `python3 -m notebooklm login` step:

```bash
cat ~/.notebooklm/storage_state.json
```

Copy the entire JSON output and paste it as the value of the `NOTEBOOKLM_AUTH_JSON` secret in the routine configuration.

### Maintenance

- **`TWITTER_COOKIES`** expire when the Twitter session expires — update in routine env config when that happens.
- **`GITHUB_MODELS_TOKEN`** (PAT) expires on the date you set (max 1 year) — rotate before expiry.
- **`NOTEBOOKLM_AUTH_JSON`** — Google OAuth sessions can expire; re-run `python3 -m notebooklm login` locally and update the secret if the NotebookLM step starts failing.

## Project structure

```
tech-newsletter/
├── src/
│   ├── index.ts          # CLI entry point and pipeline orchestration
│   ├── config.ts         # Config + env loader
│   ├── scraper.ts        # Twitter scraping
│   ├── summarizer.ts     # GPT-4o-mini summarization
│   ├── llm.ts            # OpenAI SDK wrapper (GitHub Models)
│   ├── renderer.ts       # HTML rendering (EJS)
│   ├── notebooklm.ts     # NotebookLM integration (--with-notebooklm)
│   ├── messenger.ts      # Telegram delivery
│   └── types.ts          # Shared TypeScript types
├── scripts/
│   ├── notebooklm_step.py      # Python entry point for notebooklm-py
│   ├── setup.sh                # New-user onboarding script
│   └── test_notebooklm_step.py # Python tests
├── templates/
│   └── newsletter.ejs    # Newsletter HTML template
├── output/               # Generated newsletters (gitignored)
├── config.json           # Accounts, keywords, Telegram chat IDs
├── requirements.txt      # Python deps (notebooklm-py)
└── .env                  # Secrets (gitignored)
```
