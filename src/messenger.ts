// src/messenger.ts
import { readFileSync } from 'fs';
import type { NewsletterData } from './types.js';
import { getEnvOrThrow } from './config.js';

export function formatTelegramMessage(data: NewsletterData): string {
  let msg = `<b>🗞 ${data.title} — ${data.date}</b>\n`;
  msg += `<i>Edition #${data.edition}</i>\n\n`;
  msg += `<b>TL;DR:</b> ${data.tldr}\n`;

  for (const section of data.sections) {
    msg += `\n<b>${section.category}</b>\n`;
    const truncated =
      section.summary.length > 500
        ? section.summary.slice(0, 500) + '...'
        : section.summary;
    msg += `${truncated}\n`;

    for (const link of section.tweetLinks.slice(0, 3)) {
      msg += `🔗 <a href="${link.url}">@${link.author}</a>\n`;
    }
  }

  return msg;
}

async function telegramPost(token: string, method: string, body: BodyInit, contentType?: string): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const headers: Record<string, string> = contentType ? { 'Content-Type': contentType } : {};
  const res = await fetch(url, { method: 'POST', headers, body });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Telegram ${method} failed (${res.status}): ${text}`);
  }
}

export async function sendTelegram(
  data: NewsletterData,
  htmlFilePath: string,
  chatIds: string[]
): Promise<void> {
  const token = getEnvOrThrow('TELEGRAM_BOT_TOKEN');
  const message = formatTelegramMessage(data);

  for (const chatId of chatIds) {
    try {
      await telegramPost(
        token,
        'sendMessage',
        JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
        'application/json'
      );

      const fileBuffer = readFileSync(htmlFilePath);
      const filename = htmlFilePath.split('/').pop() ?? 'newsletter.html';
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('document', new Blob([fileBuffer], { type: 'text/html' }), filename);
      await telegramPost(token, 'sendDocument', form);

      console.log(`Messenger: sent to chat ${chatId}`);
    } catch (err) {
      console.error(`Messenger: failed to send to chat ${chatId}:`, (err as Error).message);
    }
  }
}
