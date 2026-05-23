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
