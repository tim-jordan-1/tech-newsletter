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
