import { Command } from 'commander';
import { loadConfig, getEnvOrThrow } from './config.js';
import { scrapeTweets } from './scraper.js';
import { summarizeTweets } from './summarizer.js';
import { renderNewsletter } from './renderer.js';
import { createNotebookWithAudio } from './notebooklm.js';
import { sendTelegram } from './messenger.js';
import { exec } from 'child_process';

const program = new Command();

program
  .name('tech-newsletter')
  .description('Generate a tech newsletter from Twitter');

program
  .command('generate')
  .description('Scrape, summarize, render, and send the newsletter')
  .option('--no-send', 'Skip Telegram delivery')
  .option('--preview', 'Open the generated HTML in the browser')
  .option('--with-notebooklm', 'Create a NotebookLM notebook with Brief audio overview')
  .action(async (options) => {
    try {
      const config = loadConfig();
      console.log(`\n📰 ${config.newsletter.title}\n`);

      console.log('Step 1/5: Scraping Twitter...');
      const tweets = await scrapeTweets(config);

      if (tweets.length === 0) {
        console.log('No tweets found. Exiting.');
        return;
      }

      console.log('Step 2/5: Summarizing with GitHub Models...');
      const { tldr, sections } = await summarizeTweets(tweets, config.twitter.keywords);

      console.log('Step 3/5: Rendering newsletter...');
      const { html, filePath } = await renderNewsletter(tldr, sections, config.newsletter.title);

      const date = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      if (options.withNotebooklm) {
        console.log('Step 4/5: Creating NotebookLM notebook...');
        await createNotebookWithAudio(tldr, sections, config.newsletter.title, date);
      } else {
        console.log('Step 4/5: Skipping NotebookLM.');
      }

      const chatIds: string[] = options.send
        ? JSON.parse(getEnvOrThrow('TELEGRAM_CHAT_IDS'))
        : [];

      if (options.send && chatIds.length > 0) {
        console.log('Step 5/5: Sending via Telegram...');
        const data = {
          title: config.newsletter.title,
          date,
          tldr,
          sections,
        };
        await sendTelegram(data, filePath, chatIds);
      } else {
        console.log('Step 5/5: Skipping Telegram delivery.');
      }

      if (options.preview) {
        exec(`open "${filePath}"`);
      }

      console.log('\n✅ Done!\n');
    } catch (err) {
      console.error('Fatal error:', (err as Error).message);
      process.exit(1);
    }
  });

program.parse();
