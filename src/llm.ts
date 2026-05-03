import OpenAI from 'openai';
import { getEnvOrThrow } from './config.js';

const MIN_DELAY_MS = 4000;
let lastCallTime = -Infinity;

/** Reset throttle state — exported for testing only. */
export function resetThrottle(): void {
  lastCallTime = -Infinity;
}

async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastCallTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastCallTime = Date.now();
}

function defaultClient(): OpenAI {
  return new OpenAI({
    baseURL: 'https://models.inference.ai.azure.com',
    apiKey: getEnvOrThrow('GITHUB_MODELS_TOKEN'),
  });
}

export async function callLLM(
  prompt: string,
  options?: { json?: boolean },
  client?: OpenAI
): Promise<string> {
  await throttle();
  const openai = client ?? defaultClient();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    ...(options?.json && { response_format: { type: 'json_object' as const } }),
  });
  return (response.choices[0]?.message?.content ?? '').trim();
}
