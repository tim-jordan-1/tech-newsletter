import { readFileSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import type { AppConfig } from './types.js';

loadEnv();

export function parseMaxAge(maxAge: string): number {
  const match = maxAge.match(/^(\d+)(h|m)$/);
  if (!match) throw new Error(`Invalid maxAge format: "${maxAge}". Use e.g. "24h" or "30m".`);
  const value = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === 'h') return value * 60 * 60 * 1000;
  return value * 60 * 1000;
}

export function loadConfig(path: string = './config.json'): AppConfig {
  const raw = readFileSync(path, 'utf-8');
  const config: AppConfig = JSON.parse(raw);

  if (!config.twitter?.accounts?.length) {
    throw new Error('config.json: twitter.accounts must have at least one account');
  }
  if (!config.newsletter?.title) {
    throw new Error('config.json: newsletter.title is required');
  }
  if (!config.newsletter?.maxAge) {
    throw new Error('config.json: newsletter.maxAge is required');
  }
  parseMaxAge(config.newsletter.maxAge);

  return config;
}

export function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}
