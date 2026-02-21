import { ensureSettings } from "@/lib/db/schema";
import Anthropic from "@anthropic-ai/sdk";

let clientInstance: Anthropic | null = null;
let cachedApiKey: string | null = null;

/**
 * Get or create an Anthropic client using the API key from settings.
 * Caches the client and recreates it if the API key changes.
 * Throws an error if no API key is configured.
 */
export async function getAIClient(): Promise<Anthropic> {
  const settings = await ensureSettings();
  const apiKey = settings.apiKey;

  if (!apiKey) {
    throw new Error(
      "No API key configured. Please add your Anthropic API key in Settings.",
    );
  }

  // Return cached client if the key hasn't changed
  if (clientInstance && cachedApiKey === apiKey) {
    return clientInstance;
  }

  clientInstance = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
  cachedApiKey = apiKey;
  return clientInstance;
}

/**
 * Get the configured model name from settings.
 */
export async function getModelName(): Promise<string> {
  const settings = await ensureSettings();
  return settings.model;
}

/**
 * Reset the cached client (useful when settings change).
 */
export function resetClient(): void {
  clientInstance = null;
  cachedApiKey = null;
}
