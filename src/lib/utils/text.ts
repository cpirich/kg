/**
 * Words ending in 's' that should NOT be singularized.
 * These are common words that end in 's' but are not plural forms.
 */
const SINGULARIZATION_EXCEPTIONS = new Set([
  "less",
  "class",
  "process",
  "bias",
  "loss",
  "axis",
  "analysis",
  "basis",
  "crisis",
  "diagnosis",
  "hypothesis",
  "thesis",
  "synthesis",
  "consensus",
  "focus",
  "status",
  "virus",
  "plus",
  "gas",
  "bus",
  "stress",
  "success",
  "access",
  "progress",
  "address",
  "express",
  "congress",
  "mass",
  "glass",
  "grass",
  "cross",
  "boss",
  "moss",
]);

/**
 * Check if a word should be excluded from singularization based on its suffix pattern.
 * Words ending in "ss", "us", "is", "sis", or "ous" are typically not simple plurals.
 */
function isSingularizationException(word: string): boolean {
  if (SINGULARIZATION_EXCEPTIONS.has(word)) {
    return true;
  }

  // Pattern-based exceptions: words ending in these suffixes are not simple plurals
  if (
    word.endsWith("ss") ||
    word.endsWith("us") ||
    word.endsWith("is") ||
    word.endsWith("sis") ||
    word.endsWith("ous")
  ) {
    return true;
  }

  return false;
}

/**
 * Normalize a topic label for deduplication.
 * - Lowercase
 * - Trim whitespace
 * - Collapse internal whitespace
 * - Basic singularization (remove trailing 's' if word length > 3)
 *   with exceptions for words that naturally end in 's'
 */
export function normalizeLabel(label: string): string {
  let normalized = label.toLowerCase().trim().replace(/\s+/g, " ");

  // Basic singularization: remove trailing 's' if the word is long enough
  // and is not an exception (words that naturally end in 's')
  if (
    normalized.length > 3 &&
    normalized.endsWith("s") &&
    !isSingularizationException(normalized)
  ) {
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
