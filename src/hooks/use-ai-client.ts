"use client";

import { ensureSettings } from "@/lib/db/schema";
import type Anthropic from "@anthropic-ai/sdk";
import { useCallback, useEffect, useState } from "react";

interface UseAIClientResult {
  client: Anthropic | null;
  isConfigured: boolean;
  error: string | null;
}

/**
 * Hook that checks whether an API key is configured and provides the client.
 * The actual client instantiation is deferred to getAIClient() in lib/ai/client.ts
 * to avoid importing the SDK at the module level in hooks.
 */
export function useAIClient(): UseAIClientResult {
  const [isConfigured, setIsConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<Anthropic | null>(null);

  const checkConfig = useCallback(async () => {
    try {
      const settings = await ensureSettings();
      if (settings.apiKey) {
        // Dynamically import to avoid SSR issues
        const { getAIClient } = await import("@/lib/ai/client");
        const aiClient = await getAIClient();
        setClient(aiClient);
        setIsConfigured(true);
        setError(null);
      } else {
        setClient(null);
        setIsConfigured(false);
        setError(
          "No API key configured. Please add your Anthropic API key in Settings.",
        );
      }
    } catch (err) {
      setClient(null);
      setIsConfigured(false);
      setError(
        err instanceof Error ? err.message : "Failed to initialize AI client",
      );
    }
  }, []);

  useEffect(() => {
    checkConfig();
  }, [checkConfig]);

  return { client, isConfigured, error };
}
