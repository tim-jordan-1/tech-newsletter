import { callClaude } from './claude-cli.js';
import type { ScrapedTweet, NewsletterSection } from './types.js';

export function categorizeTweets(tweets: ScrapedTweet[], keywords: string[]): Map<string, ScrapedTweet[]> {
  const categories = new Map<string, ScrapedTweet[]>();
  const assigned = new Set<string>();

  for (const keyword of keywords) {
    const lower = keyword.toLowerCase();
    const matching = tweets.filter(
      (t) => !assigned.has(t.id) && t.text.toLowerCase().includes(lower)
    );
    if (matching.length > 0) {
      categories.set(keyword, matching);
      matching.forEach((t) => assigned.add(t.id));
    }
  }

  const uncategorized = tweets.filter((t) => !assigned.has(t.id));
  if (uncategorized.length > 0) {
    categories.set('General', uncategorized);
  }

  return categories;
}

async function summarizeCategory(
  category: string,
  tweets: ScrapedTweet[]
): Promise<NewsletterSection> {
  const tweetText = tweets.map((t) => `@${t.author}: ${t.text}`).join('\n\n');
  const summary = await callClaude(
    `You are writing a section for a tech newsletter. Summarize these tweets about "${category}" into 2-3 concise paragraphs covering the key developments and trends. Write in a professional newsletter tone.\n\nTweets:\n${tweetText}`
  );

  const tweetLinks = tweets.slice(0, 5).map((t) => ({
    author: t.author,
    url: t.url,
    text: t.text.length > 100 ? t.text.slice(0, 100) + '...' : t.text,
  }));

  return { category, summary, tweetLinks };
}

export async function summarizeTweets(
  tweets: ScrapedTweet[],
  keywords: string[]
): Promise<{ tldr: string; sections: NewsletterSection[] }> {
  const categories = categorizeTweets(tweets, keywords);
  const sections: NewsletterSection[] = [];

  for (const [category, categoryTweets] of categories) {
    try {
      console.log(`Summarizer: processing "${category}" (${categoryTweets.length} tweets)...`);
      const section = await summarizeCategory(category, categoryTweets);
      sections.push(section);
    } catch (err) {
      console.warn(`Summarizer: failed for "${category}":`, (err as Error).message);
      sections.push({
        category,
        summary: categoryTweets.map((t) => `@${t.author}: ${t.text}`).join('\n\n'),
        tweetLinks: categoryTweets.slice(0, 5).map((t) => ({
          author: t.author,
          url: t.url,
          text: t.text.length > 100 ? t.text.slice(0, 100) + '...' : t.text,
        })),
      });
    }
  }

  let tldr = '';
  try {
    const allSummaries = sections.map((s) => `${s.category}: ${s.summary}`).join('\n\n');
    tldr = await callClaude(
      `Write a 2-3 sentence TL;DR overview for a tech newsletter based on these section summaries:\n\n${allSummaries}`
    );
  } catch (err) {
    console.warn('Summarizer: failed to generate TL;DR:', (err as Error).message);
    tldr = sections.map((s) => s.category).join(', ');
  }

  return { tldr, sections };
}
