# NotebookLM Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `--with-notebooklm` flag to `npm run generate` that creates a NotebookLM notebook and triggers a Brief audio overview after rendering.

**Architecture:** A new `src/notebooklm.ts` module exports two functions — `formatAsMarkdown` (pure formatter) and `createNotebookWithAudio` (spawns a thin Python script). The Python script uses `notebooklm-py` async APIs. `index.ts` wires the new step between renderer and Telegram. The NotebookLM step is fire-and-forget: soft-fails on Python errors, hard-fails only on missing auth env var.

**Tech Stack:** Node.js (tsx/ESM), TypeScript, `node:test`, Python 3.10+, `notebooklm-py>=0.3.4`, `asyncio`, `unittest.mock`

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/notebooklm.ts` | `formatAsMarkdown` + `createNotebookWithAudio` |
| Create | `src/notebooklm.test.ts` | Node.js tests for both functions |
| Create | `scripts/notebooklm_step.py` | Thin async Python entry point for notebooklm-py |
| Create | `scripts/test_notebooklm_step.py` | Python unittest for the script |
| Modify | `src/index.ts` | Add `--with-notebooklm` flag, hoist date, update step counters |
| Modify | `.env.example` | Add `NOTEBOOKLM_AUTH_JSON` entry |
| Create | `requirements.txt` | `notebooklm-py>=0.3.4` for remote pip install |

---

## Task 1: `formatAsMarkdown`

**Files:**
- Create: `src/notebooklm.ts`
- Create: `src/notebooklm.test.ts`

- [ ] **Step 1: Write the failing tests for `formatAsMarkdown`**

Create `src/notebooklm.test.ts`:

```typescript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';
import { formatAsMarkdown, createNotebookWithAudio } from './notebooklm.js';
import type { NewsletterSection } from './types.js';

const sampleSections: NewsletterSection[] = [
  {
    category: 'AI',
    stories: [
      {
        headline: 'GPT-5 Released',
        bullets: ['40% gains on math benchmarks', 'Available via API immediately'],
        sources: [
          { author: 'sama', url: 'https://x.com/sama/1' },
          { author: 'gdb', url: 'https://x.com/gdb/2' },
        ],
      },
    ],
  },
];

describe('formatAsMarkdown', () => {
  test('includes # TL;DR heading and prose', () => {
    const md = formatAsMarkdown('Big week in tech.', sampleSections);
    assert.ok(md.includes('# TL;DR'));
    assert.ok(md.includes('Big week in tech.'));
  });

  test('includes section as ## heading', () => {
    const md = formatAsMarkdown('tldr', sampleSections);
    assert.ok(md.includes('## AI'));
  });

  test('includes story as ### heading', () => {
    const md = formatAsMarkdown('tldr', sampleSections);
    assert.ok(md.includes('### GPT-5 Released'));
  });

  test('includes bullets as - list items', () => {
    const md = formatAsMarkdown('tldr', sampleSections);
    assert.ok(md.includes('- 40% gains on math benchmarks'));
    assert.ok(md.includes('- Available via API immediately'));
  });

  test('includes Sources line with @author names', () => {
    const md = formatAsMarkdown('tldr', sampleSections);
    assert.ok(md.includes('Sources: @sama, @gdb'));
  });

  test('does not include source URLs', () => {
    const md = formatAsMarkdown('tldr', sampleSections);
    assert.ok(!md.includes('https://'));
  });

  test('empty sections produces only TL;DR block', () => {
    const md = formatAsMarkdown('Summary.', []);
    assert.ok(md.includes('# TL;DR'));
    assert.ok(md.includes('Summary.'));
    assert.ok(!md.includes('##'));
  });
});
```

- [ ] **Step 2: Run tests — expect import failure**

```bash
cd /Users/timjordan/dev/tech-newsletter && tsx --test src/notebooklm.test.ts
```

Expected: error about `./notebooklm.js` not found.

- [ ] **Step 3: Implement `formatAsMarkdown` in `src/notebooklm.ts`**

Create `src/notebooklm.ts` with this content (the `createNotebookWithAudio` stub is needed so the import resolves):

```typescript
import { spawn as nodeSpawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import type { NewsletterSection } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function formatAsMarkdown(tldr: string, sections: NewsletterSection[]): string {
  const parts: string[] = ['# TL;DR', tldr, ''];

  for (const section of sections) {
    parts.push(`## ${section.category}`, '');
    for (const story of section.stories) {
      parts.push(`### ${story.headline}`);
      for (const bullet of story.bullets) {
        parts.push(`- ${bullet}`);
      }
      if (story.sources.length > 0) {
        const authors = story.sources.map((s) => `@${s.author}`).join(', ');
        parts.push(`Sources: ${authors}`);
      }
      parts.push('');
    }
  }

  return parts.join('\n').trim();
}

export async function createNotebookWithAudio(
  _tldr: string,
  _sections: NewsletterSection[],
  _title: string,
  _date: string,
  _spawnFn = nodeSpawn
): Promise<void> {
  throw new Error('not implemented');
}
```

- [ ] **Step 4: Run `formatAsMarkdown` tests — expect all pass**

```bash
cd /Users/timjordan/dev/tech-newsletter && tsx --test src/notebooklm.test.ts 2>&1 | grep -E "formatAsMarkdown|pass|fail|ok"
```

Expected: 7 passing tests for `formatAsMarkdown`. The `createNotebookWithAudio` tests will fail (not yet written).

- [ ] **Step 5: Commit**

```bash
cd /Users/timjordan/dev/tech-newsletter && git add src/notebooklm.ts src/notebooklm.test.ts && git commit -m "feat: add formatAsMarkdown with tests"
```

---

## Task 2: `createNotebookWithAudio`

**Files:**
- Modify: `src/notebooklm.ts` (replace stub with real implementation)
- Modify: `src/notebooklm.test.ts` (add `createNotebookWithAudio` tests)

- [ ] **Step 1: Add `createNotebookWithAudio` tests to `src/notebooklm.test.ts`**

Append these tests after the `formatAsMarkdown` describe block (the full `createNotebookWithAudio` section — add to existing file):

```typescript
// Helper: returns a mock spawn function that emits close with the given exit code
function makeSpawnMock(exitCode: number, stderrText = '') {
  return (_cmd: string, _args: string[]) => {
    const stderr = new EventEmitter();
    const child = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
    child.stderr = stderr;
    setImmediate(() => {
      if (stderrText) stderr.emit('data', Buffer.from(stderrText));
      child.emit('close', exitCode);
    });
    return child;
  };
}

describe('createNotebookWithAudio', () => {
  test('passes correct args to python script', async (t) => {
    process.env.NOTEBOOKLM_AUTH_JSON = '{"cookies":[]}';
    t.after(() => { delete process.env.NOTEBOOKLM_AUTH_JSON; });

    let capturedCmd = '';
    let capturedArgs: string[] = [];
    const mockSpawn = (cmd: string, args: string[]) => {
      capturedCmd = cmd;
      capturedArgs = [...args];
      return makeSpawnMock(0)(cmd, args);
    };

    await createNotebookWithAudio(
      'tldr', sampleSections, 'Tech Newsletter', 'Friday, May 23, 2026',
      mockSpawn as any
    );

    assert.equal(capturedCmd, 'python3');
    assert.ok(capturedArgs[0].endsWith('notebooklm_step.py'), `script path should end with notebooklm_step.py, got: ${capturedArgs[0]}`);
    assert.equal(capturedArgs[1], '--title');
    assert.equal(capturedArgs[2], 'Tech Newsletter — Friday, May 23, 2026');
    assert.equal(capturedArgs[3], '--content-file');
    assert.ok(capturedArgs[4].startsWith('/tmp/'), `temp file should be in /tmp/, got: ${capturedArgs[4]}`);
    assert.ok(capturedArgs[4].endsWith('.md'));
  });

  test('soft-fails on non-zero exit: logs warning, does not throw', async (t) => {
    process.env.NOTEBOOKLM_AUTH_JSON = '{"cookies":[]}';
    t.after(() => { delete process.env.NOTEBOOKLM_AUTH_JSON; });

    const warnings: string[] = [];
    t.mock.method(console, 'warn', (msg: string) => warnings.push(msg));

    await assert.doesNotReject(() =>
      createNotebookWithAudio(
        'tldr', sampleSections, 'Tech Newsletter', 'Friday, May 23, 2026',
        makeSpawnMock(1, 'Auth failed') as any
      )
    );

    assert.ok(warnings.some((w) => w.includes('⚠️ NotebookLM step failed')));
    assert.ok(warnings.some((w) => w.includes('Auth failed')));
  });

  test('hard-fails when NOTEBOOKLM_AUTH_JSON is missing', async () => {
    delete process.env.NOTEBOOKLM_AUTH_JSON;

    await assert.rejects(
      () => createNotebookWithAudio(
        'tldr', sampleSections, 'Tech Newsletter', 'Friday, May 23, 2026',
        makeSpawnMock(0) as any
      ),
      /NOTEBOOKLM_AUTH_JSON/
    );
  });

  test('cleans up temp file on success', async (t) => {
    process.env.NOTEBOOKLM_AUTH_JSON = '{"cookies":[]}';
    t.after(() => { delete process.env.NOTEBOOKLM_AUTH_JSON; });

    let tempFilePath = '';
    const mockSpawn = (cmd: string, args: string[]) => {
      tempFilePath = args[4];
      return makeSpawnMock(0)(cmd, args);
    };

    await createNotebookWithAudio(
      'tldr', sampleSections, 'Tech Newsletter', 'Friday, May 23, 2026',
      mockSpawn as any
    );

    const { access } = await import('fs/promises');
    await assert.rejects(() => access(tempFilePath), { code: 'ENOENT' });
  });

  test('cleans up temp file on failure', async (t) => {
    process.env.NOTEBOOKLM_AUTH_JSON = '{"cookies":[]}';
    t.after(() => { delete process.env.NOTEBOOKLM_AUTH_JSON; });

    let tempFilePath = '';
    const mockSpawn = (cmd: string, args: string[]) => {
      tempFilePath = args[4];
      return makeSpawnMock(1, 'Error')(cmd, args);
    };

    await createNotebookWithAudio(
      'tldr', sampleSections, 'Tech Newsletter', 'Friday, May 23, 2026',
      mockSpawn as any
    );

    const { access } = await import('fs/promises');
    await assert.rejects(() => access(tempFilePath), { code: 'ENOENT' });
  });
});
```

- [ ] **Step 2: Run new tests — expect failures**

```bash
cd /Users/timjordan/dev/tech-newsletter && tsx --test src/notebooklm.test.ts 2>&1 | grep -E "createNotebookWithAudio|not implemented|fail|pass"
```

Expected: `createNotebookWithAudio` tests fail with "not implemented".

- [ ] **Step 3: Replace the stub with the real implementation in `src/notebooklm.ts`**

Replace the `createNotebookWithAudio` function (keep `formatAsMarkdown` unchanged):

```typescript
export async function createNotebookWithAudio(
  tldr: string,
  sections: NewsletterSection[],
  title: string,
  date: string,
  spawnFn = nodeSpawn
): Promise<void> {
  if (!process.env.NOTEBOOKLM_AUTH_JSON) {
    throw new Error('NOTEBOOKLM_AUTH_JSON is required for --with-notebooklm but is not set');
  }

  const notebookTitle = `${title} — ${date}`;
  const content = formatAsMarkdown(tldr, sections);
  const tempFile = `/tmp/${randomUUID()}.md`;
  const scriptPath = resolve(__dirname, '../scripts/notebooklm_step.py');

  await writeFile(tempFile, content, 'utf8');

  try {
    await new Promise<void>((res, rej) => {
      const child = spawnFn('python3', [scriptPath, '--title', notebookTitle, '--content-file', tempFile]);
      let stderrOutput = '';

      child.stderr!.on('data', (data: Buffer) => {
        stderrOutput += data.toString();
      });

      child.on('close', (code: number | null) => {
        if (code !== 0) {
          rej(new Error(stderrOutput.trim() || `python3 exited with code ${code}`));
        } else {
          res();
        }
      });

      child.on('error', rej);
    });
  } catch (err) {
    console.warn(`⚠️ NotebookLM step failed: ${(err as Error).message}`);
  } finally {
    await unlink(tempFile).catch(() => {});
  }
}
```

- [ ] **Step 4: Run all notebooklm tests — expect all pass**

```bash
cd /Users/timjordan/dev/tech-newsletter && tsx --test src/notebooklm.test.ts
```

Expected: all 12 tests pass (7 `formatAsMarkdown` + 5 `createNotebookWithAudio`).

- [ ] **Step 5: Run full test suite — expect no regressions**

```bash
cd /Users/timjordan/dev/tech-newsletter && npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/timjordan/dev/tech-newsletter && git add src/notebooklm.ts src/notebooklm.test.ts && git commit -m "feat: add createNotebookWithAudio with tests"
```

---

## Task 3: Python Script + Tests

**Files:**
- Create: `scripts/notebooklm_step.py`
- Create: `scripts/test_notebooklm_step.py`

The `scripts/` directory does not exist yet — it will be created when the files are written.

Prerequisites: `notebooklm-py` must be installed in the active Python environment. Run `python3 -m pip install notebooklm-py` if needed.

- [ ] **Step 1: Write the failing Python tests**

Create `scripts/test_notebooklm_step.py`:

```python
import asyncio
import sys
import unittest
from pathlib import Path
from tempfile import NamedTemporaryFile
from unittest.mock import AsyncMock, MagicMock, patch

# Allow importing notebooklm_step from the same directory
sys.path.insert(0, str(Path(__file__).parent))


def make_client_mock():
    """Returns (client, async_context_manager) ready for patching."""
    nb = MagicMock(id="notebook-123")

    client = MagicMock()
    client.notebooks = MagicMock()
    client.notebooks.create = AsyncMock(return_value=nb)
    client.sources = MagicMock()
    client.sources.add_text = AsyncMock(return_value=MagicMock())
    client.artifacts = MagicMock()
    client.artifacts.generate_audio = AsyncMock(return_value=MagicMock())

    cm = AsyncMock()
    cm.__aenter__ = AsyncMock(return_value=client)
    cm.__aexit__ = AsyncMock(return_value=False)

    return client, cm


class TestNotebookLMStep(unittest.TestCase):
    def setUp(self):
        self.tmp = NamedTemporaryFile(mode="w", suffix=".md", delete=False)
        self.tmp.write("# TL;DR\nTest newsletter content.")
        self.tmp.flush()
        self.tmp.close()
        self.content_file = self.tmp.name

    def tearDown(self):
        Path(self.content_file).unlink(missing_ok=True)

    @patch("notebooklm_step.NotebookLMClient")
    def test_creates_notebook_with_title(self, MockClient):
        client, cm = make_client_mock()
        MockClient.from_storage = AsyncMock(return_value=cm)

        sys.argv = [
            "notebooklm_step.py",
            "--title", "Tech Newsletter — Friday, May 23, 2026",
            "--content-file", self.content_file,
        ]

        import notebooklm_step
        exit_code = asyncio.run(notebooklm_step.main())

        self.assertEqual(exit_code, 0)
        client.notebooks.create.assert_called_once_with(
            "Tech Newsletter — Friday, May 23, 2026"
        )

    @patch("notebooklm_step.NotebookLMClient")
    def test_add_text_called_with_title_content_and_wait_true(self, MockClient):
        client, cm = make_client_mock()
        MockClient.from_storage = AsyncMock(return_value=cm)

        sys.argv = [
            "notebooklm_step.py",
            "--title", "Tech Newsletter — Friday, May 23, 2026",
            "--content-file", self.content_file,
        ]

        import notebooklm_step
        asyncio.run(notebooklm_step.main())

        call_args = client.sources.add_text.call_args
        self.assertEqual(call_args.args[0], "notebook-123")          # notebook_id
        self.assertEqual(call_args.args[1], "Tech Newsletter — Friday, May 23, 2026")  # title
        self.assertIn("TL;DR", call_args.args[2])                    # content
        self.assertTrue(call_args.kwargs.get("wait"), "wait=True required")

    @patch("notebooklm_step.NotebookLMClient")
    def test_generate_audio_called_with_brief_format(self, MockClient):
        from notebooklm import AudioFormat

        client, cm = make_client_mock()
        MockClient.from_storage = AsyncMock(return_value=cm)

        sys.argv = [
            "notebooklm_step.py",
            "--title", "Tech Newsletter — Friday, May 23, 2026",
            "--content-file", self.content_file,
        ]

        import notebooklm_step
        asyncio.run(notebooklm_step.main())

        client.artifacts.generate_audio.assert_called_once_with(
            "notebook-123", audio_format=AudioFormat.BRIEF
        )

    @patch("notebooklm_step.NotebookLMClient")
    def test_returns_nonzero_on_client_exception(self, MockClient):
        MockClient.from_storage = AsyncMock(side_effect=Exception("Auth failed"))

        sys.argv = [
            "notebooklm_step.py",
            "--title", "Test",
            "--content-file", self.content_file,
        ]

        import notebooklm_step
        exit_code = asyncio.run(notebooklm_step.main())

        self.assertEqual(exit_code, 1)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run Python tests — expect import failure**

```bash
cd /Users/timjordan/dev/tech-newsletter && python3 -m pytest scripts/test_notebooklm_step.py -v 2>&1 | head -20
```

Expected: `ModuleNotFoundError: No module named 'notebooklm_step'`.

- [ ] **Step 3: Write `scripts/notebooklm_step.py`**

Create `scripts/notebooklm_step.py`:

```python
import argparse
import asyncio
import sys
from pathlib import Path

from notebooklm import AudioFormat, NotebookLMClient


async def main() -> int:
    parser = argparse.ArgumentParser(description="Create a NotebookLM notebook with audio overview.")
    parser.add_argument("--title", required=True, help="Notebook title")
    parser.add_argument("--content-file", required=True, dest="content_file", help="Path to markdown content file")
    args = parser.parse_args()

    content = Path(args.content_file).read_text(encoding="utf-8")

    try:
        async with await NotebookLMClient.from_storage() as client:
            nb = await client.notebooks.create(args.title)
            await client.sources.add_text(nb.id, args.title, content, wait=True)
            await client.artifacts.generate_audio(nb.id, audio_format=AudioFormat.BRIEF)
        return 0
    except Exception as e:
        print(str(e), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
```

- [ ] **Step 4: Run Python tests — expect all pass**

```bash
cd /Users/timjordan/dev/tech-newsletter && python3 -m pytest scripts/test_notebooklm_step.py -v
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/timjordan/dev/tech-newsletter && git add scripts/notebooklm_step.py scripts/test_notebooklm_step.py && git commit -m "feat: add notebooklm_step.py async Python script with tests"
```

---

## Task 4: Wire up `index.ts`

**Files:**
- Modify: `src/index.ts`

There are no new tests for `index.ts` — the integration behaviour (flag parsing, step counter, date hoisting) is verified by running the test suite, which confirms no regressions.

- [ ] **Step 1: Replace `src/index.ts` entirely**

```typescript
import { Command } from 'commander';
import { loadConfig, getEnvOrThrow } from './config.js';
import { scrapeTweets } from './scraper.js';
import { summarizeTweets } from './summarizer.js';
import { renderNewsletter } from './renderer.js';
import { createNotebookWithAudio } from './notebooklm.js';
import { sendTelegram } from './messenger.js';
import { exec } from 'child_process';

const program = new Command();

program
  .name('tech-newsletter')
  .description('Generate a tech newsletter from Twitter');

program
  .command('generate')
  .description('Scrape, summarize, render, and send the newsletter')
  .option('--no-send', 'Skip Telegram delivery')
  .option('--preview', 'Open the generated HTML in the browser')
  .option('--with-notebooklm', 'Create a NotebookLM notebook with Brief audio overview')
  .action(async (options) => {
    try {
      const config = loadConfig();
      console.log(`\n📰 ${config.newsletter.title}\n`);

      console.log('Step 1/5: Scraping Twitter...');
      const tweets = await scrapeTweets(config);

      if (tweets.length === 0) {
        console.log('No tweets found. Exiting.');
        return;
      }

      console.log('Step 2/5: Summarizing with GitHub Models...');
      const { tldr, sections } = await summarizeTweets(tweets, config.twitter.keywords);

      console.log('Step 3/5: Rendering newsletter...');
      const { html, filePath } = await renderNewsletter(tldr, sections, config.newsletter.title);

      const date = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      if (options.withNotebooklm) {
        console.log('Step 4/5: Creating NotebookLM notebook...');
        await createNotebookWithAudio(tldr, sections, config.newsletter.title, date);
      } else {
        console.log('Step 4/5: Skipping NotebookLM.');
      }

      const chatIds: string[] = options.send
        ? JSON.parse(getEnvOrThrow('TELEGRAM_CHAT_IDS'))
        : [];

      if (options.send && chatIds.length > 0) {
        console.log('Step 5/5: Sending via Telegram...');
        const data = {
          title: config.newsletter.title,
          date,
          tldr,
          sections,
        };
        await sendTelegram(data, filePath, chatIds);
      } else {
        console.log('Step 5/5: Skipping Telegram delivery.');
      }

      if (options.preview) {
        exec(`open "${filePath}"`);
      }

      console.log('\n✅ Done!\n');
    } catch (err) {
      console.error('Fatal error:', (err as Error).message);
      process.exit(1);
    }
  });

program.parse();
```

Note: `html` is destructured but unused — this matches the pre-existing pattern in this file.

- [ ] **Step 2: Run full test suite — expect no regressions**

```bash
cd /Users/timjordan/dev/tech-newsletter && npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/timjordan/dev/tech-newsletter && git add src/index.ts && git commit -m "feat: wire --with-notebooklm into generate pipeline"
```

---

## Task 5: Config Files

**Files:**
- Modify: `.env.example`
- Create: `requirements.txt`

- [ ] **Step 1: Add `NOTEBOOKLM_AUTH_JSON` to `.env.example`**

Append to the end of `.env.example`:

```
# JSON content of ~/.notebooklm/storage_state.json — required for --with-notebooklm
# To get: cat ~/.notebooklm/storage_state.json
NOTEBOOKLM_AUTH_JSON=
```

- [ ] **Step 2: Create `requirements.txt`**

Create `requirements.txt` at the project root:

```
notebooklm-py>=0.3.4
```

- [ ] **Step 3: Commit**

```bash
cd /Users/timjordan/dev/tech-newsletter && git add .env.example requirements.txt && git commit -m "chore: add NOTEBOOKLM_AUTH_JSON to .env.example and requirements.txt"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `--with-notebooklm` flag | Task 4 |
| Step counter always X/5 | Task 4 |
| Date hoisted above Step 4 | Task 4 |
| `notebooklm.ts` with `formatAsMarkdown` | Task 1 |
| `notebooklm.ts` with `createNotebookWithAudio` | Task 2 |
| Markdown: `#`/`##`/`###` structure | Task 1 |
| Markdown: `Sources: @author` (no URLs) | Task 1 |
| Python script: async + `asyncio.run` | Task 3 |
| Python script: `add_text` with title + `wait=True` | Task 3 |
| Python script: `AudioFormat.BRIEF` | Task 3 |
| Hard-fail on missing `NOTEBOOKLM_AUTH_JSON` | Task 2 |
| Soft-fail on Python non-zero exit | Task 2 |
| Temp file cleanup in `finally` | Task 2 |
| `requirements.txt` | Task 5 |
| `.env.example` addition | Task 5 |
| Node.js tests | Tasks 1–2 |
| Python tests | Task 3 |

All requirements covered. No gaps found.
