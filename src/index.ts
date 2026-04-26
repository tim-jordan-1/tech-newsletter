import { Command } from 'commander';
import { loadConfig, parseMaxAge } from './config.js';
import { scrapeTweets } from './scraper.js';
import { summarizeTweets } from './summarizer.js';
import { renderNewsletter } from './renderer.js';
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
  .action(async (options) => {
    try {
      const config = loadConfig();
      console.log(`\n📰 ${config.newsletter.title}\n`);

      console.log('Step 1/4: Scraping Twitter...');
      const tweets = await scrapeTweets(config);

      if (tweets.length === 0) {
        console.log('No tweets found. Exiting.');
        return;
      }

      console.log('Step 2/4: Summarizing with Claude...');
      const { tldr, sections } = await summarizeTweets(tweets, config.twitter.keywords);

      console.log('Step 3/4: Rendering newsletter...');
      const { html, filePath } = await renderNewsletter(tldr, sections, config.newsletter.title);

      if (options.send && config.telegram.chatIds.length > 0) {
        console.log('Step 4/4: Sending via Telegram...');
        const data = {
          title: config.newsletter.title,
          date: new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          edition: 0,
          tldr,
          sections,
        };
        await sendTelegram(data, filePath, config.telegram.chatIds);
      } else {
        console.log('Step 4/4: Skipping Telegram delivery.');
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
