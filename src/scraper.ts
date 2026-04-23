import { Scraper, SearchMode } from '@the-convocation/twitter-scraper';
import { Cookie } from 'tough-cookie';
import type { AppConfig, ScrapedTweet } from './types.js';
import { getEnvOrThrow } from './config.js';
import { parseMaxAge } from './config.js';

function parseCookies(cookieJson: string): Cookie[] {
  const raw = JSON.parse(cookieJson);
  return raw.map((c: Record<string, string>) => {
    return Cookie.fromJSON({
      key: c.name,
      value: c.value,
      domain: c.domain ?? '.x.com',
      path: c.path ?? '/',
    })!;
  });
}

function tweetToScraped(tweet: { id?: string; username?: string; text?: string; permanentUrl?: string; timeParsed?: Date }): ScrapedTweet | null {
  if (!tweet.id || !tweet.text || !tweet.username) return null;
  return {
    id: tweet.id,
    author: tweet.username,
    text: tweet.text,
    url: tweet.permanentUrl ?? `https://x.com/${tweet.username}/status/${tweet.id}`,
    timestamp: tweet.timeParsed ?? new Date(),
  };
}

export async function scrapeTweets(config: AppConfig): Promise<ScrapedTweet[]> {
  const scraper = new Scraper();

  const cookieJson = getEnvOrThrow('TWITTER_COOKIES');
  const cookies = parseCookies(cookieJson);
  await scraper.setCookies(cookies);

  const loggedIn = await scraper.isLoggedIn();
  if (!loggedIn) {
    throw new Error('Twitter authentication failed. Check your cookies in .env');
  }
  console.log('Twitter: authenticated successfully');

  const maxAgeMs = parseMaxAge(config.newsletter.maxAge);
  const cutoff = new Date(Date.now() - maxAgeMs);
  const seen = new Set<string>();
  const tweets: ScrapedTweet[] = [];

  function addTweet(t: ScrapedTweet) {
    if (seen.has(t.id)) return;
    if (t.timestamp < cutoff) return;
    seen.add(t.id);
    tweets.push(t);
  }

  for (const account of config.twitter.accounts) {
    try {
      console.log(`Twitter: scraping @${account}...`);
      const generator = scraper.getTweets(account, config.twitter.maxTweetsPerAccount);
      for await (const tweet of generator) {
        const scraped = tweetToScraped(tweet);
        if (scraped) addTweet(scraped);
      }
    } catch (err) {
      console.warn(`Twitter: failed to scrape @${account}:`, (err as Error).message);
    }
  }

  for (const keyword of config.twitter.keywords) {
    try {
      console.log(`Twitter: searching "${keyword}"...`);
      const generator = scraper.searchTweets(keyword, config.twitter.maxTweetsPerKeyword, SearchMode.Top);
      for await (const tweet of generator) {
        const scraped = tweetToScraped(tweet);
        if (scraped) addTweet(scraped);
      }
    } catch (err) {
      console.warn(`Twitter: failed to search "${keyword}":`, (err as Error).message);
    }
  }

  console.log(`Twitter: scraped ${tweets.length} unique tweets`);
  return tweets;
}
