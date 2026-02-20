/**
 * Normalize a topic label for deduplication.
 * - Lowercase
 * - Trim whitespace
 * - Collapse internal whitespace
 * - Basic singularization (remove trailing 's' if word length > 3)
 */
export function normalizeLabel(label: string): string {
  let normalized = label.toLowerCase().trim().replace(/\s+/g, " ");

  // Basic singularization: remove trailing 's' if the word is long enough
  // This is intentionally simple — handles "neurons" → "neuron", "methods" → "method"
  // but avoids breaking "gas", "bus", etc.
  if (normalized.length > 3 && normalized.endsWith("s")) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Compute SHA-256 hex hash of a string using Web Crypto API.
 */
export async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
