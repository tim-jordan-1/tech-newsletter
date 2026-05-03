# Tech Newsletter

Automated tech newsletter pipeline that scrapes Twitter/X, summarizes with AI, and delivers via Telegram.

## How it works

1. **Scrape** — Fetches recent tweets from a curated list of accounts and keyword searches using your authenticated Twitter session
2. **Categorize** — Groups tweets by topic (AI, TypeScript, web development, etc.)
3. **Summarize** — Sends each category to GPT-4o-mini (via GitHub Models) to write newsletter-style summaries
4. **Render** — Produces a styled HTML newsletter saved to `output/`
5. **Deliver** — Sends a formatted message + the HTML file to your Telegram chat

## Prerequisites

- Node.js 20+
- npm

## Setup

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

| Variable | Description |
|---|---|
| `TWITTER_COOKIES` | JSON array of Twitter/X session cookies (exported from browser DevTools) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from [@BotFather](https://t.me/BotFather) |
| `GITHUB_MODELS_TOKEN` | GitHub fine-grained PAT with `models:read` scope |

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

### 5. Create a GitHub Models token

1. Go to **GitHub Settings → Developer settings → Fine-grained personal access tokens** ([direct link](https://github.com/settings/tokens?type=beta))
2. Click **Generate new token**
3. Name it (e.g., `tech-newsletter`)
4. Set an expiration date (max 1 year)
5. Under **Permissions → Account permissions**, set **Models** to **Read-only**
6. Click **Generate token** and paste the value into `.env` as `GITHUB_MODELS_TOKEN`

> Named `GITHUB_MODELS_TOKEN` (not `GITHUB_TOKEN`) to avoid collision with the automatic `GITHUB_TOKEN` in GitHub Actions, which lacks `models:read` scope.

### 6. Customize accounts and keywords

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

# Run all tests
npm test
```

## Claude Code Routine (daily automation)

To run the pipeline daily on Anthropic cloud infrastructure:

1. Create a Claude Code Routine with:
   - **Trigger:** Daily cron at 8:00 AM AEST (`Australia/Sydney`)
   - **Repository:** `tim-jordan-1/tech-newsletter`
   - **Prompt:** `Run npm install && npm run generate to scrape tweets, summarize, and send the newsletter via Telegram.`

2. Configure these environment variables in the routine settings:
   - `TWITTER_COOKIES`
   - `TELEGRAM_BOT_TOKEN`
   - `GITHUB_MODELS_TOKEN`

3. Enable **unrestricted network access** (the pipeline calls Twitter, GitHub Models API, and Telegram API).

### Maintenance

- **`TWITTER_COOKIES`** expire when the Twitter session expires — update in routine env config when that happens.
- **`GITHUB_MODELS_TOKEN`** (PAT) expires on the date you set (max 1 year) — rotate before expiry.

## Project structure

```
tech-newsletter/
├── src/
│   ├── index.ts        # CLI entry point
│   ├── config.ts       # Config + env loader
│   ├── scraper.ts      # Twitter scraping
│   ├── summarizer.ts   # GPT-4o-mini summarization
│   ├── llm.ts          # OpenAI SDK wrapper (GitHub Models)
│   ├── renderer.ts     # HTML rendering (EJS)
│   ├── messenger.ts    # Telegram delivery
│   └── types.ts        # Shared TypeScript types
├── templates/
│   └── newsletter.ejs  # Newsletter HTML template
├── output/             # Generated newsletters (gitignored)
├── config.json         # Accounts, keywords, Telegram chat IDs
└── .env                # Secrets (gitignored)
```
