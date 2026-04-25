import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync } from 'node:fs';
import { formatTelegramMessage, sendTelegram } from './messenger.js';
import type { NewsletterData } from './types.js';

const sampleData: NewsletterData = {
  title: 'Tech Weekly',
  date: '2026-04-25',
  edition: 42,
  tldr: 'Big things happened.',
  sections: [
    {
      category: 'AI',
      summary: 'AI keeps moving fast.',
      tweetLinks: [
        { author: 'sama', url: 'https://x.com/sama/1', text: 'tweet text' },
        { author: 'karpathy', url: 'https://x.com/karpathy/2', text: 'another tweet' },
        { author: 'ylecun', url: 'https://x.com/ylecun/3', text: 'more tweet' },
        { author: 'extra', url: 'https://x.com/extra/4', text: 'should not appear' },
      ],
    },
  ],
};

describe('formatTelegramMessage', () => {
  test('includes title, date, and edition', () => {
    const msg = formatTelegramMessage(sampleData);
    assert.ok(msg.includes('Tech Weekly'));
    assert.ok(msg.includes('2026-04-25'));
    assert.ok(msg.includes('Edition #42'));
  });

  test('includes tldr', () => {
    const msg = formatTelegramMessage(sampleData);
    assert.ok(msg.includes('Big things happened.'));
  });

  test('includes section category and summary', () => {
    const msg = formatTelegramMessage(sampleData);
    assert.ok(msg.includes('AI'));
    assert.ok(msg.includes('AI keeps moving fast.'));
  });

  test('includes at most 3 tweet links per section', () => {
    const msg = formatTelegramMessage(sampleData);
    assert.ok(msg.includes('@sama'));
    assert.ok(msg.includes('@karpathy'));
    assert.ok(msg.includes('@ylecun'));
    assert.ok(!msg.includes('@extra'));
  });

  test('truncates long summaries to 500 characters', () => {
    const longSummary = 'x'.repeat(600);
    const data: NewsletterData = {
      ...sampleData,
      sections: [{ category: 'Long', summary: longSummary, tweetLinks: [] }],
    };
    const msg = formatTelegramMessage(data);
    assert.ok(msg.includes('...'));
    assert.ok(!msg.includes('x'.repeat(600)));
  });

  test('does not truncate summaries under 500 characters', () => {
    const shortSummary = 'y'.repeat(499);
    const data: NewsletterData = {
      ...sampleData,
      sections: [{ category: 'Short', summary: shortSummary, tweetLinks: [] }],
    };
    const msg = formatTelegramMessage(data);
    assert.ok(msg.includes('y'.repeat(499)));
    assert.ok(!msg.includes('...'));
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
    assert.ok(callCount >= 2);

    unlinkSync(tmpFile);
  });
});
