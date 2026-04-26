import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { callClaude } from './claude-cli.js';

type FakeExecFile = (file: string, args: string[], cb: (err: Error | null, stdout: string, stderr: string) => void) => void;

describe('callClaude', () => {
  test('returns trimmed stdout from claude CLI', async () => {
    const fake: FakeExecFile = (_file, _args, cb) => cb(null, '  summary text\n', '');
    const result = await callClaude('test prompt', fake);
    assert.equal(result, 'summary text');
  });

  test('passes prompt as -p argument to claude executable', async () => {
    let capturedFile = '';
    let capturedArgs: string[] = [];
    const fake: FakeExecFile = (file, args, cb) => {
      capturedFile = file;
      capturedArgs = args;
      cb(null, 'response', '');
    };
    await callClaude('my prompt', fake);
    assert.equal(capturedFile, 'claude');
    assert.deepEqual(capturedArgs, ['-p', 'my prompt']);
  });

  test('throws helpful error when claude CLI not found (ENOENT)', async () => {
    const enoent = Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' });
    const fake: FakeExecFile = (_file, _args, cb) => cb(enoent, '', '');
    await assert.rejects(
      () => callClaude('test prompt', fake),
      /claude CLI not found — is Claude Code/
    );
  });

  test('propagates non-ENOENT errors', async () => {
    const fake: FakeExecFile = (_file, _args, cb) => cb(new Error('exit code 1'), '', '');
    await assert.rejects(
      () => callClaude('test prompt', fake),
      /exit code 1/
    );
  });
});
