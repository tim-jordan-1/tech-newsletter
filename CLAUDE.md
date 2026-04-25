# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

# Run a single test file
tsx --test src/config.test.ts
```

TypeScript is executed directly via `tsx` — there is no compile step needed during development.

## Environment Setup

Copy `.env.example` to `.env` and populate:

- `TWITTER_COOKIES` — JSON array of Twitter/X cookies (exported from browser DevTools). Must be a valid logged-in session.
- `ANTHROPIC_API_KEY` — Used by the summarizer for Claude Haiku calls.
- `TELEGRAM_BOT_TOKEN` — Telegram bot token for delivery.

## Architecture

The pipeline runs in four sequential steps, each implemented in its own module:

1. **`scraper.ts`** — Authenticates to Twitter/X via cookie injection using `@the-convocation/twitter-scraper`. Collects tweets from configured accounts and keyword searches, deduplicates by tweet ID, and filters by `maxAge`.

2. **`summarizer.ts`** — Categorizes tweets by keyword match (first-match wins, uncategorized → "General"), then calls Claude Haiku (`claude-haiku-4-5-20251001`) once per category to produce newsletter sections, plus a final TL;DR call across all sections.

3. **`renderer.ts`** — Renders the `templates/newsletter.ejs` template into HTML and writes it to `output/YYYY-MM-DD-newsletter.html`. Tracks a monotonically incrementing edition number in a `.edition` file.

4. **`messenger.ts`** — Sends an HTML-formatted Telegram message (truncated for readability) and the full HTML file as an attachment to each configured chat ID.

**`config.ts`** loads `config.json` (newsletter/twitter/telegram settings) and provides `getEnvOrThrow` for required env vars.

**`types.ts`** defines all shared interfaces: `AppConfig`, `ScrapedTweet`, `NewsletterSection`, `NewsletterData`.

## Configuration

Edit `config.json` to change behavior without touching code:

- `twitter.accounts` — list of @handles to scrape
- `twitter.keywords` — used for both search queries and tweet categorization
- `twitter.maxTweetsPerAccount` / `twitter.maxTweetsPerKeyword` — scrape limits
- `newsletter.maxAge` — how far back to collect tweets, e.g. `"24h"` or `"30m"`
- `telegram.chatIds` — list of Telegram chat IDs to deliver to (empty = skip delivery)
