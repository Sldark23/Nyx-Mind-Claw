/**
 * Parse tool calls from LLM text output.
 * Supports two formats:
 *   1) Raw JSON: { "tool": "name", "args": { ... } }
 *   2) JSON inside markdown: ```json { ... } ```
 */
import { ToolCall } from './types';

/**
 * Safely parses a JSON string. Returns the parsed value or null on any error.
 */
function safeJsonParse<T = unknown>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export class ToolParser {
  /**
   * Extract the first valid ToolCall from LLM output text.
   * Returns null if no valid tool call found.
   */
  parse(text: string): ToolCall | null {
    const fenced = this.parseFenced(text);
    if (fenced) return fenced;
    return this.parseRaw(text);
  }

  private parseFenced(text: string): ToolCall | null {
    const match = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (!match) return null;
    return this.parseJSON(match[1]);
  }

  private parseRaw(text: string): ToolCall | null {
    const firstBrace = text.indexOf('{');
    if (firstBrace < 0) return null;

    // Try JSON.parse from the first { with increasingly longer substrings
    for (let end = firstBrace + 1; end <= text.length; end++) {
      const candidate = text.slice(firstBrace, end);
      const parsed = safeJsonParse<{ tool?: unknown; args?: unknown }>(candidate);
      if (parsed && typeof parsed.tool === 'string' && parsed.args && typeof parsed.args === 'object') {
        return {
          tool: parsed.tool.trim(),
          args: parsed.args as Record<string, unknown>,
        };
      }
    }
    return null;
  }

  private parseJSON(raw: string): ToolCall | null {
    const jsonStart = raw.indexOf('{');
    const jsonStr = jsonStart >= 0 ? raw.slice(jsonStart) : raw;
    const parsed = safeJsonParse<{ tool?: unknown; args?: unknown }>(jsonStr);
    if (
      parsed &&
      typeof parsed.tool === 'string' &&
      parsed.args &&
      typeof parsed.args === 'object'
    ) {
      return {
        tool: parsed.tool.trim(),
        args: parsed.args as Record<string, unknown>,
      };
    }
    return null;
  }
}
