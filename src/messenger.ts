import TelegramBot from 'node-telegram-bot-api';
import { readFileSync } from 'fs';
import type { NewsletterData } from './types.js';
import { getEnvOrThrow } from './config.js';

function formatTelegramMessage(data: NewsletterData): string {
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

export async function sendTelegram(
  data: NewsletterData,
  htmlFilePath: string,
  chatIds: string[]
): Promise<void> {
  const token = getEnvOrThrow('TELEGRAM_BOT_TOKEN');
  const bot = new TelegramBot(token);

  const message = formatTelegramMessage(data);

  for (const chatId of chatIds) {
    try {
      await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });

      const fileBuffer = readFileSync(htmlFilePath);
      await bot.sendDocument(chatId, fileBuffer, {}, {
        filename: htmlFilePath.split('/').pop() ?? 'newsletter.html',
        contentType: 'text/html',
      });

      console.log(`Messenger: sent to chat ${chatId}`);
    } catch (err) {
      console.error(`Messenger: failed to send to chat ${chatId}:`, (err as Error).message);
    }
  }
}
