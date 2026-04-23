import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { categorizeTweets } from './summarizer.js';
import type { ScrapedTweet } from './types.js';

const makeTweet = (id: string, text: string): ScrapedTweet => ({
  id,
  author: 'testuser',
  text,
  url: `https://x.com/testuser/status/${id}`,
  timestamp: new Date(),
});

describe('categorizeTweets', () => {
  test('groups tweets by matching keywords', () => {
    const tweets = [
      makeTweet('1', 'New AI model released today'),
      makeTweet('2', 'TypeScript 6.0 is amazing'),
      makeTweet('3', 'Great web development tutorial'),
      makeTweet('4', 'Random tweet about cooking'),
    ];
    const keywords = ['AI', 'typescript', 'web development'];
    const result = categorizeTweets(tweets, keywords);

    assert.ok(result.has('AI'));
    assert.ok(result.has('typescript'));
    assert.ok(result.has('web development'));
    assert.equal(result.get('AI')!.length, 1);
    assert.equal(result.get('AI')![0].id, '1');
    assert.equal(result.get('typescript')!.length, 1);
    assert.equal(result.get('web development')!.length, 1);
  });

  test('puts uncategorized tweets in General', () => {
    const tweets = [makeTweet('1', 'Random tweet about cooking')];
    const result = categorizeTweets(tweets, ['AI']);
    assert.ok(result.has('General'));
    assert.equal(result.get('General')!.length, 1);
  });

  test('assigns tweet to first matching keyword only', () => {
    const tweets = [makeTweet('1', 'AI web development tool')];
    const result = categorizeTweets(tweets, ['AI', 'web development']);
    assert.equal(result.get('AI')!.length, 1);
    assert.equal(result.has('web development'), false);
  });
});
