import { ProviderFactory } from './provider';
import { ToolRegistry } from './tools/registry';
import { ChatMessage, ToolCall } from './types';

export class AgentLoop {
  constructor(private llm: ProviderFactory, private tools: ToolRegistry, private maxIterations = 5) {}

  async run(userInput: string, skillContent?: string) {
    const messages: ChatMessage[] = [];

    if (skillContent) messages.push({ role: 'system', content: skillContent });
    messages.push({ role: 'user', content: userInput });

    for (let i = 0; i < this.maxIterations; i++) {
      const response = await this.llm.chat(messages);

      const toolCall = this.parseToolCall(response);
      if (!toolCall) return response;

      const output = await this.executeTool(toolCall);
      messages.push({ role: 'tool', content: output });
    }

    return '⚠️ Max iterations reached.';
  }

  private parseToolCall(text: string): ToolCall | null {
    try {
      const match = text.match(/\{.*\}/s);
      if (!match) return null;
      const parsed = JSON.parse(match[0]);
      if (parsed.tool && parsed.args) return parsed as ToolCall;
      return null;
    } catch {
      return null;
    }
  }

  private async executeTool(call: ToolCall): Promise<string> {
    switch (call.tool) {
      case 'shell':
        return this.tools.shell(call.args.command);
      case 'read_file':
        return this.tools.readFile(call.args.path);
      case 'write_file':
        return this.tools.writeFile(call.args.path, call.args.content);
      case 'web_search':
        return this.tools.searchWeb(call.args.query);
      case 'web_fetch':
        return this.tools.fetchUrl(call.args.url);
      default:
        return `Unknown tool: ${call.tool}`;
    }
  }
}
