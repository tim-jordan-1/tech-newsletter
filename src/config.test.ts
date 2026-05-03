import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, parseMaxAge } from './config.js';

describe('parseMaxAge', () => {
  test('parses "24h" to milliseconds', () => {
    assert.equal(parseMaxAge('24h'), 24 * 60 * 60 * 1000);
  });

  test('parses "12h" to milliseconds', () => {
    assert.equal(parseMaxAge('12h'), 12 * 60 * 60 * 1000);
  });

  test('parses "30m" to milliseconds', () => {
    assert.equal(parseMaxAge('30m'), 30 * 60 * 1000);
  });

  test('throws on invalid format', () => {
    assert.throws(() => parseMaxAge('abc'), /Invalid maxAge format/);
  });
});

describe('loadConfig', () => {
  test('loads and validates config from a path', () => {
    const config = loadConfig('./config.json');
    assert.ok(config.twitter.accounts.length > 0);
    assert.ok(config.newsletter.title);
  });
});
