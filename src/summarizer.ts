import { callClaude } from './claude-cli.js';
import type { ScrapedTweet, NewsletterSection, NewsletterStory } from './types.js';

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
  const tweetText = tweets
    .map((t, i) => `[${i}] @${t.author}: ${t.text}`)
    .join('\n\n');

  const raw = await callClaude(
    `You are writing a section for a tech newsletter about "${category}".\n` +
    `Analyze these tweets and identify the distinct news stories.\n` +
    `For each story, provide:\n` +
    `- headline: a bold, concise one-line title\n` +
    `- bullets: 2-3 key detail points (short sentences, no markdown)\n` +
    `- sourceIndices: array of 0-based indices of which tweets are sources for this story\n\n` +
    `Return ONLY valid JSON in this exact format:\n` +
    `{\n` +
    `  "stories": [\n` +
    `    {\n` +
    `      "headline": "...",\n` +
    `      "bullets": ["...", "..."],\n` +
    `      "sourceIndices": [0, 2]\n` +
    `    }\n` +
    `  ]\n` +
    `}\n` +
    `No other text before or after the JSON.\n\n` +
    `Tweets:\n${tweetText}`
  );

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  try {
    const parsed = JSON.parse(cleaned) as { stories: Array<{ headline: string; bullets: string[]; sourceIndices: number[] }> };
    const stories: NewsletterStory[] = parsed.stories.map((story) => ({
      headline: story.headline,
      bullets: story.bullets,
      sources: story.sourceIndices.map((i) => ({ author: tweets[i].author, url: tweets[i].url })),
    }));
    return { category, stories };
  } catch {
    // Fallback: single story with raw tweet texts as bullets
    const stories: NewsletterStory[] = [
      {
        headline: category,
        bullets: tweets.map((t) => `@${t.author}: ${t.text}`),
        sources: tweets.map((t) => ({ author: t.author, url: t.url })),
      },
    ];
    return { category, stories };
  }
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
        stories: [
          {
            headline: category,
            bullets: categoryTweets.map((t) => `@${t.author}: ${t.text}`),
            sources: categoryTweets.map((t) => ({ author: t.author, url: t.url })),
          },
        ],
      });
    }
  }

  let tldr = '';
  try {
    const allHeadlines = sections
      .map((s) => `${s.category}: ${s.stories.map((st) => st.headline).join('; ')}`)
      .join('\n');
    tldr = await callClaude(
      `Write exactly 2-3 sentences as a TL;DR overview for a tech newsletter based on these section headlines. Use plain prose only — no markdown formatting, no bold, no headings, no bullet points.\n\n${allHeadlines}`
    );
  } catch (err) {
    console.warn('Summarizer: failed to generate TL;DR:', (err as Error).message);
    tldr = sections.map((s) => s.category).join(', ');
  }

  return { tldr, sections };
}
