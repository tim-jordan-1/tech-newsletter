# NotebookLM Integration Design

**Date:** 2026-05-23  
**Project:** tech-newsletter  
**Status:** Approved

## Overview

After generating the tech newsletter, optionally create a Google NotebookLM notebook containing the newsletter content and trigger a short audio overview (Brief format). The audio generates asynchronously on NotebookLM's servers — the pipeline does not wait for completion. The user views the finished audio on their phone by logging into the same NotebookLM account.

Triggered by a new `--with-notebooklm` flag on `npm run generate`. Designed for remote execution via Claude routines.

---

## Architecture

### Pipeline changes

The `generate` command gains a new Step 5, inserted after the renderer and before Telegram:

```
Step 1: scraper.ts     → tweets[]
Step 2: summarizer.ts  → { tldr, sections }
Step 3: renderer.ts    → { html, filePath }
Step 4: notebooklm.ts  → fire-and-forget (opt-in via --with-notebooklm)
Step 5: messenger.ts   → Telegram delivery
```

The step counter messages in `index.ts` update from `Step X/4` to `Step X/5` to reflect the new total.

Step 5 is non-blocking: a failure logs a warning and the pipeline continues to Telegram delivery.

### Language bridge

`notebooklm.ts` (Node.js) spawns `scripts/notebooklm_step.py` (Python) as a child process, passing newsletter content via a temp file. The Python script uses the `notebooklm-py` PyPI package — no local sibling dependency.

```
index.ts (--with-notebooklm)
  → notebooklm.ts: formatAsMarkdown(tldr, sections) → /tmp/<uuid>.md
  → spawn: python3 scripts/notebooklm_step.py --title "..." --content-file /tmp/<uuid>.md
    [NOTEBOOKLM_AUTH_JSON env var picked up automatically by notebooklm-py]
    → client.notebooks.create(title)          → notebook_id
    → client.sources.add_text(notebook_id, content)
    → client.artifacts.generate_audio(notebook_id, audio_format=AudioFormat.BRIEF)
    → exit 0
  → cleanup /tmp/<uuid>.md (finally block)
```

---

## New files

### `src/notebooklm.ts`

Two exported functions:

- `formatAsMarkdown(tldr, sections)` — formats newsletter data as clean markdown: TL;DR header, then one `##` section per category containing headlines and bullet points. This is the content fed to NotebookLM.
- `createNotebookWithAudio(tldr, sections, title, date)` — writes formatted content to a temp file, spawns the Python script with `--title` and `--content-file` args, cleans up the temp file in a `finally` block.

### `scripts/notebooklm_step.py`

Thin Python entry point (~40 lines):

- `argparse`: `--title`, `--content-file`
- Reads content from `--content-file`
- Opens `NotebookLMClient.from_storage()` (auto-reads `NOTEBOOKLM_AUTH_JSON`)
- Calls `notebooks.create(title)` → `sources.add_text(nb.id, content)` → `artifacts.generate_audio(nb.id, audio_format=AudioFormat.BRIEF)`
- Exits 0 on success, non-zero on any exception (exception message to stderr)

### `requirements.txt`

```
notebooklm-py>=0.3.4
```

Used by the remote execution environment to install the package via pip.

### `.env.example` addition

```
# JSON content of ~/.notebooklm/storage_state.json — required for --with-notebooklm
# To get: cat ~/.notebooklm/storage_state.json
NOTEBOOKLM_AUTH_JSON=
```

---

## Notebook details

- **Title:** `Tech Newsletter — [date]` e.g. `Tech Newsletter — Friday, May 23, 2026`
- **Source:** newsletter content as pasted text (via `add_text`)
- **Audio format:** `AudioFormat.BRIEF` — short-form overview, appropriate for a newsletter digest
- **Audio length:** default (not specified — NotebookLM chooses based on content)

---

## Error handling

| Scenario | Behaviour |
|---|---|
| `--with-notebooklm` set, `NOTEBOOKLM_AUTH_JSON` missing | Hard fail: throw immediately before spawning, clear message |
| Python script exits non-zero | Soft fail: log `⚠️ NotebookLM step failed: <stderr>`, pipeline continues |
| Temp file write fails | Hard fail: throw (can't proceed without content file) |
| Temp file cleanup | Always runs in `finally` block, regardless of outcome |

No retries. Partial notebook state (notebook created but source/audio not added) is left as-is — cleaning up on failure adds complexity not worth it for fire-and-forget.

---

## Testing

### `src/notebooklm.test.ts` (Node.js `node:test`)

- `formatAsMarkdown`: tldr formatting, section/story structure, empty sections edge case
- `createNotebookWithAudio`:
  - Correct script path, `--title`, `--content-file` args passed to spawn
  - Soft-fail on non-zero exit (warning logged, no throw)
  - Hard-fail when `NOTEBOOKLM_AUTH_JSON` missing
  - Temp file cleaned up on both success and failure paths

### `scripts/test_notebooklm_step.py` (Python `unittest`)

- `NotebookLMClient` mocked — no network calls
- `notebooks.create`, `sources.add_text`, `artifacts.generate_audio` called with correct args
- `AudioFormat.BRIEF` passed to `generate_audio`
- Non-zero exit on client exception

---

## Remote execution setup

To run via Claude routines, configure these secrets in the remote environment:

| Secret | Value | Notes |
|---|---|---|
| `TWITTER_COOKIES` | JSON array of Twitter cookies | Already env-var based |
| `GITHUB_MODELS_TOKEN` | GitHub PAT with `models:read` | Already env-var based |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | Already env-var based |
| `TELEGRAM_CHAT_IDS` | JSON array of chat IDs | Already env-var based |
| `NOTEBOOKLM_AUTH_JSON` | Content of `~/.notebooklm/storage_state.json` | New — run `cat ~/.notebooklm/storage_state.json` to get value |

The remote environment also needs Python 3.10+ with `python3 -m pip install -r requirements.txt` run once before the pipeline executes. `notebooklm.ts` spawns `python3` — the same interpreter that has `notebooklm-py` installed must be the one on PATH as `python3`.

---

## What is not in scope

- Waiting for audio generation to complete
- Downloading the audio file locally
- Surfacing a notebook URL to the user
- Changes to `notebooklm-py` source code
- Multiple audio formats or configurable length via CLI flag
