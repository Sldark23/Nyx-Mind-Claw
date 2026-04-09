import { ProviderFactory } from './provider';
import { ToolRegistry } from './tools';
import { ChatMessage, ToolCall } from './types';

const MAX_ITERATIONS = parseInt(process.env.MAX_ITERATIONS || '5', 10);

export class AgentLoop {
  private maxIterations: number;

  constructor(
    private llm: ProviderFactory,
    private tools: ToolRegistry,
    maxIterations = MAX_ITERATIONS
  ) {
    this.maxIterations = maxIterations;
  }

  async run(userInput: string, context?: string): Promise<string> {
    const messages: ChatMessage[] = [];
    const toolPrompt = this.tools.buildSystemPrompt();

    if (context) {
      messages.push({ role: 'system', content: context + '\n\n' + toolPrompt });
    } else if (toolPrompt) {
      messages.push({ role: 'system', content: toolPrompt });
    }

    messages.push({ role: 'user', content: userInput });

    for (let iteration = 1; iteration <= this.maxIterations; iteration++) {
      console.log(`\n🔄 [Loop:iter ${iteration}/${this.maxIterations}] Sending to ${this.llm.getModelName()}`);

      let response: string;
      try {
        response = await this.llm.chat(messages);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Loop:error] LLM call failed: ${message}`);
        return `⚠️ Erro na chamada ao LLM: ${message}`;
      }

      console.log(`[Loop:thought]\n${response}\n`);

      const toolCall = this.parseToolCall(response);

      if (!toolCall) {
        console.log(`[Loop:final] No tool call detected, returning response.`);
        return response;
      }

      console.log(`[Loop:action] Calling tool=${toolCall.tool} args=${JSON.stringify(toolCall.args)}`);

      let output: string;
      try {
        output = await this.executeTool(toolCall);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Loop:tool-error] ${message}`);
        output = `Tool error: ${message}`;
      }

      console.log(`[Loop:observation] ${output.slice(0, 200)}${output.length > 200 ? '...' : ''}`);

      messages.push({ role: 'assistant', content: response });
      messages.push({ role: 'tool', content: output });
    }

    console.log(`[Loop:max-iterations] Reached MAX_ITERATIONS=${this.maxIterations}, giving up.`);
    return '⚠️ Desculpe, o processamento excedeu o limite de iterações. Por favor, tente uma pergunta mais específica.';
  }

  private parseToolCall(text: string): ToolCall | null {
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return null;

    try {
      const parsed = JSON.parse(match[0]);
      if (parsed.tool && parsed.args && typeof parsed.tool === 'string') {
        return parsed as ToolCall;
      }
      return null;
    } catch {
      console.warn(`[Loop:parse-error] JSON malformado: ${match[0].slice(0, 100)}`);
      return null;
    }
  }

  private async executeTool(call: ToolCall): Promise<string> {
    switch (call.tool) {
      case 'shell':
        return this.tools.shell(call.args.command as string);
      case 'read_file':
        return this.tools.readFile(call.args.path as string);
      case 'write_file':
        return this.tools.writeFile(call.args.path as string, call.args.content as string);
      case 'web_search':
        return this.tools.searchWeb(call.args.query as string);
      case 'web_fetch':
        return this.tools.fetchUrl(call.args.url as string);
      default:
        return `Unknown tool: ${call.tool}`;
    }
  }
}