/**
 * Try to parse a JSON response from the AI, extracting from markdown code blocks if needed.
 */
export function parseJsonResponse(text: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Try extracting from markdown code block
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1].trim());
    }
    throw new Error(`Failed to parse JSON response: ${text.slice(0, 200)}`);
  }
}
