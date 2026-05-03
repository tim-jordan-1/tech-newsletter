# chatIds Env Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Claude will auto-select superpowers:subagent-driven-development or superpowers:executing-plans based on plan size. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `telegram.chatIds` from `config.json` to `.env` as `TELEGRAM_CHAT_IDS` (JSON array), removing the `telegram` section from config entirely.

**Architecture:** Delete `TelegramConfig` from types, remove the `telegram` block from `config.json`, and parse `TELEGRAM_CHAT_IDS` in `index.ts` only when `--send` is active — so `--no-send` runs require no Telegram credentials at all.

**Tech Stack:** TypeScript, Node.js `node:test`, `tsx` (no compile step — run files directly)

---

### Task 1: Remove TelegramConfig from types and clean up the config test

**Files:**
- Modify: `src/types.ts`
- Modify: `src/config.test.ts`

- [ ] **Step 1: Update `src/config.test.ts` — remove the telegram assertion**

The test currently asserts `config.telegram.chatIds` exists. That field is being removed. Delete that line so the test reflects the new shape.

In `src/config.test.ts`, change:
```typescript
describe('loadConfig', () => {
  test('loads and validates config from a path', () => {
    const config = loadConfig('./config.json');
    assert.ok(config.twitter.accounts.length > 0);
    assert.ok(config.newsletter.title);
    assert.ok(Array.isArray(config.telegram.chatIds));
  });
});
```
to:
```typescript
describe('loadConfig', () => {
  test('loads and validates config from a path', () => {
    const config = loadConfig('./config.json');
    assert.ok(config.twitter.accounts.length > 0);
    assert.ok(config.newsletter.title);
  });
});
```

- [ ] **Step 2: Run the config test to confirm it still passes**

```bash
tsx --test src/config.test.ts
```

Expected: all tests pass (the telegram assertion is gone, no TypeScript errors yet since `types.ts` still has the field).

- [ ] **Step 3: Update `src/types.ts` — delete `TelegramConfig` and remove `telegram` from `AppConfig`**

Change `src/types.ts` from:
```typescript
export interface TelegramConfig {
  chatIds: string[];
}

export interface AppConfig {
  twitter: TwitterConfig;
  newsletter: NewsletterConfig;
  telegram: TelegramConfig;
}
```
to:
```typescript
export interface AppConfig {
  twitter: TwitterConfig;
  newsletter: NewsletterConfig;
}
```

- [ ] **Step 4: Run the full test suite to confirm no TypeScript errors**

```bash
npm test
```

Expected: all tests pass. TypeScript will no longer see a `telegram` property on `AppConfig`, but nothing currently references it (the config test assertion was already removed in Step 1, and `index.ts` will be fixed in Task 3).

> **Note:** If `npm test` errors on `config.telegram.chatIds` in `index.ts`, that's expected — it will be fixed in Task 3. You can run just the config and messenger tests instead:
> ```bash
> tsx --test src/config.test.ts && tsx --test src/messenger.test.ts
> ```

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/config.test.ts
git commit -m "refactor: remove TelegramConfig type and telegram config test assertion"
```

---

### Task 2: Remove telegram block from config.json and add TELEGRAM_CHAT_IDS to .env.example

**Files:**
- Modify: `config.json`
- Modify: `.env.example`

- [ ] **Step 1: Remove the `telegram` block from `config.json`**

Change `config.json` from:
```json
{
  "twitter": {
    "accounts": ["AnthropicAI", "elaboratedcode", "ThePrimeagen", "levelsio"],
    "keywords": ["AI", "web development", "typescript"],
    "maxTweetsPerAccount": 20,
    "maxTweetsPerKeyword": 30
  },
  "newsletter": {
    "title": "Tech Newsletter",
    "maxAge": "24h"
  },
  "telegram": {
    "chatIds": [
      "7750341504"
    ]
  }
}
```
to:
```json
{
  "twitter": {
    "accounts": ["AnthropicAI", "elaboratedcode", "ThePrimeagen", "levelsio"],
    "keywords": ["AI", "web development", "typescript"],
    "maxTweetsPerAccount": 20,
    "maxTweetsPerKeyword": 30
  },
  "newsletter": {
    "title": "Tech Newsletter",
    "maxAge": "24h"
  }
}
```

- [ ] **Step 2: Add `TELEGRAM_CHAT_IDS` to `.env.example`**

Change `.env.example` from:
```
TWITTER_COOKIES=[]
TELEGRAM_BOT_TOKEN=your-bot-token
GITHUB_MODELS_TOKEN=your-github-pat-with-models-read
```
to:
```
TWITTER_COOKIES=[]
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_IDS=["your-chat-id"]
GITHUB_MODELS_TOKEN=your-github-pat-with-models-read
```

- [ ] **Step 3: Add `TELEGRAM_CHAT_IDS` to your local `.env` file**

Your actual `.env` (not committed to git) needs to include the chat ID that was previously in `config.json`. Open `.env` and add:

```
TELEGRAM_CHAT_IDS=["7750341504"]
```

Replace `7750341504` with your actual chat ID(s) if different.

- [ ] **Step 4: Run the config test to confirm it still passes**

```bash
tsx --test src/config.test.ts
```

Expected: all tests pass. `loadConfig` no longer sees a `telegram` key in the JSON and `AppConfig` no longer expects one.

- [ ] **Step 5: Commit**

```bash
git add config.json .env.example
git commit -m "refactor: remove telegram.chatIds from config.json, add TELEGRAM_CHAT_IDS to .env.example"
```

---

### Task 3: Update index.ts to parse TELEGRAM_CHAT_IDS from env

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Update the import in `src/index.ts` to include `getEnvOrThrow`**

Change:
```typescript
import { loadConfig, parseMaxAge } from './config.js';
```
to:
```typescript
import { loadConfig, parseMaxAge, getEnvOrThrow } from './config.js';
```

- [ ] **Step 2: Replace `config.telegram.chatIds` with env-based parsing**

In the `generate` action handler, replace:
```typescript
if (options.send && config.telegram.chatIds.length > 0) {
  console.log('Step 4/4: Sending via Telegram...');
  const data = {
    title: config.newsletter.title,
    date: new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    tldr,
    sections,
  };
  await sendTelegram(data, filePath, config.telegram.chatIds);
} else {
  console.log('Step 4/4: Skipping Telegram delivery.');
}
```
with:
```typescript
const chatIds: string[] = options.send
  ? JSON.parse(getEnvOrThrow('TELEGRAM_CHAT_IDS'))
  : [];

if (options.send && chatIds.length > 0) {
  console.log('Step 4/4: Sending via Telegram...');
  const data = {
    title: config.newsletter.title,
    date: new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    tldr,
    sections,
  };
  await sendTelegram(data, filePath, chatIds);
} else {
  console.log('Step 4/4: Skipping Telegram delivery.');
}
```

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: all tests pass with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "refactor: read TELEGRAM_CHAT_IDS from env in index.ts"
```
