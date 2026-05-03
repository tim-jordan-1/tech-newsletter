# Design: Migrate chatIds from config.json to .env

**Date:** 2026-05-03

## Summary

Move `telegram.chatIds` out of `config.json` and into `.env` as `TELEGRAM_CHAT_IDS` (JSON array). The `telegram` section in `config.json` will be removed entirely since it will carry no remaining fields.

## Motivation

`chatIds` are delivery targets — more like secrets/credentials than static configuration. Keeping them in `.env` alongside `TELEGRAM_BOT_TOKEN` makes `.env` the single source of truth for all Telegram delivery settings.

## Changes

### `config.json`

Remove the `telegram` block entirely:

```diff
-  "telegram": {
-    "chatIds": [
-      "7750341504"
-    ]
-  }
```

### `types.ts`

Delete `TelegramConfig` interface and the `telegram` field from `AppConfig`:

```diff
-export interface TelegramConfig {
-  chatIds: string[];
-}

 export interface AppConfig {
   twitter: TwitterConfig;
   newsletter: NewsletterConfig;
-  telegram: TelegramConfig;
 }
```

### `.env.example`

Add the new variable:

```diff
+TELEGRAM_CHAT_IDS=["your-chat-id"]
```

### `config.ts`

No changes needed. `getEnvOrThrow` already exists and will be called from `index.ts`.

### `index.ts`

Parse `TELEGRAM_CHAT_IDS` locally when `--send` is active, replacing the `config.telegram.chatIds` reference:

```diff
-if (options.send && config.telegram.chatIds.length > 0) {
+const chatIds: string[] = options.send
+  ? JSON.parse(getEnvOrThrow('TELEGRAM_CHAT_IDS'))
+  : [];
+if (options.send && chatIds.length > 0) {
   ...
-  await sendTelegram(data, filePath, config.telegram.chatIds);
+  await sendTelegram(data, filePath, chatIds);
```

Import `getEnvOrThrow` from `./config.js`.

### `config.test.ts`

Remove the `config.telegram.chatIds` assertion — that field no longer exists on `AppConfig`.

## Data Flow

```
.env (TELEGRAM_CHAT_IDS) → index.ts (JSON.parse) → sendTelegram(chatIds)
```

## Behavior: `--no-send` runs require no Telegram credentials

When `--no-send` is passed, neither `TELEGRAM_CHAT_IDS` nor `TELEGRAM_BOT_TOKEN` need to be set:

- The ternary in `index.ts` short-circuits to `[]` when `options.send` is false, so `getEnvOrThrow('TELEGRAM_CHAT_IDS')` is never called.
- `sendTelegram` (which reads `TELEGRAM_BOT_TOKEN` internally) is only invoked when `options.send && chatIds.length > 0`, so `TELEGRAM_BOT_TOKEN` is also never read.

This makes `--no-send` (and `--preview`) fully usable without any Telegram configuration in `.env`.

## What Is Not Changing

- `messenger.ts` — already accepts `chatIds` as a parameter, no changes needed
- `messenger.test.ts` — passes `chatIds` directly, unaffected
- All other config fields remain in `config.json`
