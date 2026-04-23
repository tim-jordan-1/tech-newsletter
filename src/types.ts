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

export interface NewsletterSection {
  category: string;
  summary: string;
  tweetLinks: Array<{ author: string; url: string; text: string }>;
}

export interface NewsletterData {
  title: string;
  date: string;
  edition: number;
  tldr: string;
  sections: NewsletterSection[];
}
