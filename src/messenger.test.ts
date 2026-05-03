import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync } from 'node:fs';
import { formatTelegramMessage, sendTelegram } from './messenger.js';
import type { NewsletterData } from './types.js';

const sampleData: NewsletterData = {
  title: 'Tech Weekly',
  date: '2026-04-25',
  tldr: 'Big things happened.',
  sections: [
    {
      category: 'AI',
      stories: [
        {
          headline: 'AI keeps moving fast',
          bullets: ['First key point', 'Second key point'],
          sources: [
            { author: 'sama', url: 'https://x.com/sama/1' },
            { author: 'karpathy', url: 'https://x.com/karpathy/2' },
            { author: 'ylecun', url: 'https://x.com/ylecun/3' },
            { author: 'extra', url: 'https://x.com/extra/4' },
          ],
        },
      ],
    },
  ],
};

describe('formatTelegramMessage', () => {
  test('includes title and date', () => {
    const msg = formatTelegramMessage(sampleData);
    assert.ok(msg.includes('Tech Weekly'));
    assert.ok(msg.includes('2026-04-25'));
  });

  test('includes tldr', () => {
    const msg = formatTelegramMessage(sampleData);
    assert.ok(msg.includes('Big things happened.'));
  });

  test('includes section category and story headline', () => {
    const msg = formatTelegramMessage(sampleData);
    assert.ok(msg.includes('AI'));
    assert.ok(msg.includes('AI keeps moving fast'));
  });

  test('includes all sources for each story', () => {
    const msg = formatTelegramMessage(sampleData);
    assert.ok(msg.includes('@sama'));
    assert.ok(msg.includes('@karpathy'));
    assert.ok(msg.includes('@ylecun'));
    assert.ok(msg.includes('@extra'));
  });

  test('verifies max 3 stories per section are included', () => {
    const data: NewsletterData = {
      ...sampleData,
      sections: [
        {
          category: 'Tech',
          stories: [
            {
              headline: 'Story 1',
              bullets: ['point'],
              sources: [{ author: 'author1', url: 'https://x.com/author1/1' }],
            },
            {
              headline: 'Story 2',
              bullets: ['point'],
              sources: [{ author: 'author2', url: 'https://x.com/author2/2' }],
            },
            {
              headline: 'Story 3',
              bullets: ['point'],
              sources: [{ author: 'author3', url: 'https://x.com/author3/3' }],
            },
            {
              headline: 'Story 4',
              bullets: ['point'],
              sources: [{ author: 'author4', url: 'https://x.com/author4/4' }],
            },
          ],
        },
      ],
    };
    const msg = formatTelegramMessage(data);
    assert.ok(msg.includes('Story 1'));
    assert.ok(msg.includes('Story 2'));
    assert.ok(msg.includes('Story 3'));
    assert.ok(!msg.includes('Story 4'));
  });

  test('verifies max 2 bullets per story are included', () => {
    const data: NewsletterData = {
      ...sampleData,
      sections: [
        {
          category: 'Tech',
          stories: [
            {
              headline: 'Multi-bullet story',
              bullets: ['Bullet 1', 'Bullet 2', 'Bullet 3', 'Bullet 4'],
              sources: [{ author: 'author', url: 'https://x.com/author/1' }],
            },
          ],
        },
      ],
    };
    const msg = formatTelegramMessage(data);
    assert.ok(msg.includes('Bullet 1'));
    assert.ok(msg.includes('Bullet 2'));
    assert.ok(!msg.includes('Bullet 3'));
    assert.ok(!msg.includes('Bullet 4'));
  });
});

describe('sendTelegram', () => {
  test('calls sendMessage and sendDocument for each chatId', async (t) => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    t.after(() => { delete process.env.TELEGRAM_BOT_TOKEN; });

    const calls: { url: string; method: string }[] = [];
    t.mock.method(globalThis, 'fetch', async (url: string, opts: RequestInit) => {
      calls.push({ url: String(url), method: String(opts.method) });
      return { ok: true };
    });

    const tmpFile = '/tmp/test-newsletter.html';
    writeFileSync(tmpFile, '<html>test</html>');

    await sendTelegram(sampleData, tmpFile, ['chat1', 'chat2']);

    unlinkSync(tmpFile);

    // 2 chats × 2 calls each = 4 total
    assert.equal(calls.length, 4);

    const sendMessageCalls = calls.filter(c => c.url.includes('sendMessage'));
    const sendDocumentCalls = calls.filter(c => c.url.includes('sendDocument'));
    assert.equal(sendMessageCalls.length, 2);
    assert.equal(sendDocumentCalls.length, 2);

    assert.ok(sendMessageCalls[0].url.includes('test-token'));
  });

  test('continues to next chatId when one fails', async (t) => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    t.after(() => { delete process.env.TELEGRAM_BOT_TOKEN; });

    let callCount = 0;
    t.mock.method(globalThis, 'fetch', async () => {
      callCount++;
      if (callCount === 1) return { ok: false, text: async () => 'Bad Request' };
      return { ok: true };
    });

    const tmpFile = '/tmp/test-newsletter-2.html';
    writeFileSync(tmpFile, '<html>test</html>');

    // Should not throw even if first chat fails
    await assert.doesNotReject(() => sendTelegram(sampleData, tmpFile, ['chat1', 'chat2']));

    // Verify processing continued to chat2 after chat1 failed
    // chat1's sendMessage fails (count=1), chat2's sendMessage succeeds (count=2), chat2's sendDocument succeeds (count=3)
    assert.equal(callCount, 3);

    unlinkSync(tmpFile);
  });

  test('throws when htmlFilePath does not exist', async (t) => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    t.after(() => { delete process.env.TELEGRAM_BOT_TOKEN; });
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true }));

    await assert.rejects(
      () => sendTelegram(sampleData, '/tmp/does-not-exist-xyz.html', ['chat1']),
      { code: 'ENOENT' }
    );
  });
});
