/**
 * Parse tool calls from LLM text output.
 * Supports two formats:
 *   1) Raw JSON: { "tool": "name", "args": { ... } }
 *   2) JSON inside markdown: ```json { ... } ```
 */
import { ToolCall } from './types';

export class ToolParser {
  /**
   * Extract the first valid ToolCall from LLM output text.
   * Returns null if no valid tool call found.
   */
  parse(text: string): ToolCall | null {
    // Try markdown-fenced JSON first
    const fenced = this.parseFenced(text);
    if (fenced) return fenced;

    // Try raw JSON anywhere in text
    return this.parseRaw(text);
  }

  private parseFenced(text: string): ToolCall | null {
    // Match ```json ... ``` or ``` ... ```
    const match = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (!match) return null;
    return this.parseJSON(match[1]);
  }

  private parseRaw(text: string): ToolCall | null {
    // Find first {...} block
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return null;
    return this.parseJSON(match[0]);
  }

  private parseJSON(raw: string): ToolCall | null {
    // Strip content before opening brace (sometimes LLM adds leading text)
    const jsonStart = raw.indexOf('{');
    const jsonStr = jsonStart >= 0 ? raw.slice(jsonStart) : raw;

    try {
      const parsed = JSON.parse(jsonStr);
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
    } catch {
      return null;
    }
  }
}
