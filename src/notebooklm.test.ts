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

  test('story with no sources omits Sources line', () => {
    const sections: NewsletterSection[] = [{ category: 'AI', stories: [{ headline: 'X', bullets: ['y'], sources: [] }] }];
    const md = formatAsMarkdown('tldr', sections);
    assert.ok(!md.includes('Sources:'));
  });

  test('story with no bullets produces no list items', () => {
    const sections: NewsletterSection[] = [{ category: 'AI', stories: [{ headline: 'X', bullets: [], sources: [] }] }];
    const md = formatAsMarkdown('tldr', sections);
    assert.ok(!md.includes('- '));
  });
});

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

  test('soft-fails when spawn emits error event', async (t) => {
    process.env.NOTEBOOKLM_AUTH_JSON = '{"cookies":[]}';
    t.after(() => { delete process.env.NOTEBOOKLM_AUTH_JSON; });

    const warnings: string[] = [];
    t.mock.method(console, 'warn', (msg: string) => warnings.push(msg));

    const errorSpawn = (_cmd: string, _args: string[]) => {
      const stderr = new EventEmitter();
      const child = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
      child.stderr = stderr;
      setImmediate(() => child.emit('error', new Error('spawn python3 ENOENT')));
      return child;
    };

    await assert.doesNotReject(() =>
      createNotebookWithAudio(
        'tldr', sampleSections, 'Tech Newsletter', 'Friday, May 23, 2026',
        errorSpawn as any
      )
    );

    assert.ok(warnings.some((w) => w.includes('⚠️ NotebookLM step failed')));
    assert.ok(warnings.some((w) => w.includes('spawn python3 ENOENT')));
  });
});
