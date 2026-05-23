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
