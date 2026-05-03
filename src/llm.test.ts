import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type OpenAI from 'openai';
import { callLLM, resetThrottle } from './llm.js';

function mockClient(content: string): OpenAI {
  return {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content } }],
        }),
      },
    },
  } as unknown as OpenAI;
}

describe('callLLM', () => {
  test('returns trimmed content from API response', async () => {
    resetThrottle();
    const client = mockClient('  summary text\n');
    const result = await callLLM('test prompt', undefined, client);
    assert.equal(result, 'summary text');
  });

  test('passes response_format when json option is true', async () => {
    resetThrottle();
    let capturedParams: Record<string, unknown> = {};
    const client = {
      chat: {
        completions: {
          create: async (params: Record<string, unknown>) => {
            capturedParams = params;
            return { choices: [{ message: { content: '{"key":"value"}' } }] };
          },
        },
      },
    } as unknown as OpenAI;

    await callLLM('test prompt', { json: true }, client);
    assert.deepEqual(capturedParams.response_format, { type: 'json_object' });
  });

  test('does not pass response_format when json option is absent', async () => {
    resetThrottle();
    let capturedParams: Record<string, unknown> = {};
    const client = {
      chat: {
        completions: {
          create: async (params: Record<string, unknown>) => {
            capturedParams = params;
            return { choices: [{ message: { content: 'plain text' } }] };
          },
        },
      },
    } as unknown as OpenAI;

    await callLLM('test prompt', undefined, client);
    assert.equal(capturedParams.response_format, undefined);
  });

  test('throws on API errors', async () => {
    resetThrottle();
    const client = {
      chat: {
        completions: {
          create: async () => {
            throw new Error('API key invalid');
          },
        },
      },
    } as unknown as OpenAI;

    await assert.rejects(
      () => callLLM('test prompt', undefined, client),
      /API key invalid/
    );
  });

  test('throttles: two rapid calls take at least 4s', async (t) => {
    resetThrottle();
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    const client = mockClient('response');

    await callLLM('prompt 1', undefined, client);

    const start = Date.now();
    const promise = callLLM('prompt 2', undefined, client);
    t.mock.timers.tick(4000);
    await promise;
    const elapsed = Date.now() - start;

    assert.ok(elapsed >= 4000, `Expected >=4000ms, got ${elapsed}ms`);
  });
});
