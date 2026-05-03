import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import ejs from 'ejs';
import type { NewsletterData } from './types.js';

export async function renderNewsletter(
  tldr: string,
  sections: NewsletterData['sections'],
  title: string
): Promise<{ html: string; filePath: string }> {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const data: NewsletterData = { title, date, tldr, sections };

  const templatePath = resolve('templates', 'newsletter.ejs');
  const template = readFileSync(templatePath, 'utf-8');
  const html = ejs.render(template, data);

  const outputDir = resolve('output');
  mkdirSync(outputDir, { recursive: true });

  const dateStr = now.toISOString().split('T')[0];
  const filePath = resolve(outputDir, `${dateStr}-newsletter.html`);
  writeFileSync(filePath, html, 'utf-8');

  console.log(`Renderer: saved to ${filePath}`);
  return { html, filePath };
}
