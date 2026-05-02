export interface TwitterConfig {
  accounts: string[];
  keywords: string[];
  maxTweetsPerAccount: number;
  maxTweetsPerKeyword: number;
}

export interface NewsletterConfig {
  title: string;
  maxAge: string;
}

export interface TelegramConfig {
  chatIds: string[];
}

export interface AppConfig {
  twitter: TwitterConfig;
  newsletter: NewsletterConfig;
  telegram: TelegramConfig;
}

export interface ScrapedTweet {
  id: string;
  author: string;
  text: string;
  url: string;
  timestamp: Date;
}

export interface NewsletterStory {
  headline: string;
  bullets: string[];
  sources: Array<{ author: string; url: string }>;
}

export interface NewsletterSection {
  category: string;
  stories: NewsletterStory[];
}

export interface NewsletterData {
  title: string;
  date: string;
  tldr: string;
  sections: NewsletterSection[];
}
