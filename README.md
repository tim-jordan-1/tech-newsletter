# Tech Newsletter

A CLI tool that scrapes Twitter, summarizes the latest tech news using Claude Haiku, and delivers a styled newsletter via Telegram — automatically, every morning.

## How it works

1. **Scrape** — Fetches recent tweets from a curated list of accounts and keyword searches using your authenticated Twitter session
2. **Categorize** — Groups tweets by topic (AI, TypeScript, web development, etc.)
3. **Summarize** — Sends each category to Claude Haiku to write newsletter-style summaries
4. **Render** — Produces a styled HTML newsletter saved to `output/`
5. **Deliver** — Sends a formatted message + the HTML file to your Telegram chat

## Project structure

```
tech-newsletter/
├── src/
│   ├── index.ts        # CLI entry point
│   ├── config.ts       # Config + env loader
│   ├── scraper.ts      # Twitter scraping
│   ├── summarizer.ts   # Claude Haiku summarization
│   ├── renderer.ts     # HTML rendering (EJS)
│   ├── messenger.ts    # Telegram delivery
│   └── types.ts        # Shared TypeScript types
├── templates/
│   └── newsletter.ejs  # Newsletter HTML template
├── output/             # Generated newsletters (gitignored)
├── config.json         # Accounts, keywords, Telegram chat IDs
└── .env                # Secrets (gitignored)
```

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

```env
TWITTER_COOKIES=<see below>
ANTHROPIC_API_KEY=sk-...
TELEGRAM_BOT_TOKEN=<see below>
```

### 3. Get Twitter cookies (authentication)

The scraper uses your existing Twitter session — no API key required.

1. Log into [twitter.com](https://twitter.com) in Chrome/Firefox
2. Open DevTools → Application → Cookies → `https://x.com`
3. Find `auth_token` and `ct0` cookies
4. Export as a JSON array and paste into `.env`:

```env
TWITTER_COOKIES=[{"name":"auth_token","value":"...","domain":".x.com"},{"name":"ct0","value":"...","domain":".x.com"}]
```

> Note: Use a secondary account if possible — automated scraping can trigger account flags.

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

### 5. Customize accounts and keywords

Edit `config.json` to follow the accounts and topics you care about:

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

## Usage

### Generate and send the newsletter

```bash
npm run generate
```

### Generate HTML only (no Telegram)

```bash
npm run generate -- --no-send
```

### Generate and preview in browser

```bash
npm run generate -- --no-send --preview
```

### Run tests

```bash
npm test
```

## Scheduling (daily at 8 AM)

To run the newsletter automatically every morning, set up a Claude Code cron job:

```
Schedule: 0 8 * * *
Command:  cd /Users/timjordan/dev/tech-newsletter && npm run generate
```

Or add a system crontab entry:

```bash
crontab -e
# Add:
0 8 * * * cd /Users/timjordan/dev/tech-newsletter && npm run generate
```

## Output

Generated newsletters are saved to `output/YYYY-MM-DD-newsletter.html`. Each run auto-increments the edition number (tracked in `.edition`).
