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

Tests use Node.js built-in `node:test` and `node:assert/strict` — not Jest or Vitest. Use `t.mock.method` for mocking and `t.after` for cleanup.

## Environment Setup

Copy `.env.example` to `.env` and populate:

- `TWITTER_COOKIES` — JSON array of Twitter/X cookies (exported from browser DevTools). Must be a valid logged-in session.
- `TELEGRAM_BOT_TOKEN` — Telegram bot token for delivery.
- `GITHUB_MODELS_TOKEN` — GitHub fine-grained PAT with `models:read` scope (see README for setup steps).

## Architecture

The pipeline runs in four sequential steps, each implemented in its own module:

1. **`scraper.ts`** — Authenticates to Twitter/X via cookie injection using `@the-convocation/twitter-scraper` and `tough-cookie`. Collects tweets from configured accounts and keyword searches, deduplicates by tweet ID, and filters by `maxAge`.

2. **`summarizer.ts`** — Categorizes tweets by keyword match (first-match wins, uncategorized → "General"), then calls GPT-4o-mini via GitHub Models (through `llm.ts`) once per category to produce newsletter sections, plus a final TL;DR call across all sections.

3. **`renderer.ts`** — Renders the `templates/newsletter.ejs` template into HTML and writes it to `output/YYYY-MM-DD-newsletter.html`.

4. **`messenger.ts`** — Sends an HTML-formatted Telegram message and the full HTML file as an attachment to each configured chat ID. The message is intentionally truncated: max 3 stories per section, 2 bullets per story, 5 source links per story. Delivery is skipped when `--no-send` is passed OR when `telegram.chatIds` is empty — both conditions are checked in `index.ts`.

**`llm.ts`** — calls GPT-4o-mini via the OpenAI SDK pointed at GitHub Models (`models.inference.ai.azure.com`). Accepts an injectable `OpenAI` client for testability. Enforces a 4-second minimum gap between requests to stay under the free-tier rate limit.

**`config.ts`** loads `config.json` and `.env` via `dotenv`, provides `getEnvOrThrow` for required env vars, and `parseMaxAge` which converts strings like `"24h"` or `"30m"` to milliseconds.

**`types.ts`** defines all shared interfaces: `AppConfig`, `ScrapedTweet`, `NewsletterSection`, `NewsletterData`, and `NewsletterStory` (the per-story shape nested inside a section: `headline`, `bullets[]`, `sources[]`).

## Configuration

Edit `config.json` to change behavior without touching code:

- `twitter.accounts` — list of @handles to scrape
- `twitter.keywords` — used for both search queries and tweet categorization
- `twitter.maxTweetsPerAccount` / `twitter.maxTweetsPerKeyword` — scrape limits
- `newsletter.maxAge` — how far back to collect tweets, e.g. `"24h"` or `"30m"`
- `telegram.chatIds` — list of Telegram chat IDs to deliver to (empty = skip delivery)

