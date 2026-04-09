/**
 * AgentLoop — the core reasoning loop.
 *
 * Architecture (each piece is swappable):
 *   LlmCall       — makes LLM calls with retry/backoff
 *   ToolParser    — extracts ToolCall from LLM text
 *   ToolExecutor  — runs the tool against the registry
 */
import { ChatMessage } from './types';
import { ProviderFactory } from '../llm';
import { ToolRegistry } from '../tools';
import { LlmCall } from './llm-call';
import { ToolParser } from './tool-parser';
import { ToolExecutor } from './tool-executor';

const MAX_ITERATIONS = parseInt(process.env.MAX_ITERATIONS || '5', 10);

export interface AgentLoopConfig {
  llm: ProviderFactory;
  tools: ToolRegistry;
  maxIterations?: number;
  /** Called before each LLM call. Pass false to skip the iteration. */
  onIteration?: (iter: number, messages: ChatMessage[]) => void;
}

export class AgentLoop {
  private readonly maxIterations: number;
  private readonly llmCall: LlmCall;
  private readonly parser: ToolParser;
  private readonly executor: ToolExecutor;
  private readonly onIteration?: AgentLoopConfig['onIteration'];

  constructor(config: AgentLoopConfig) {
    this.maxIterations = config.maxIterations ?? MAX_ITERATIONS;
    this.llmCall = new LlmCall(config.llm);
    this.parser = new ToolParser();
    this.executor = new ToolExecutor({ registry: config.tools });
    this.onIteration = config.onIteration;
  }

  /**
   * Run the agent loop with a user input.
   * Returns the final text response (no tool calls detected).
   */
  async run(userInput: string, context?: string): Promise<string> {
    const messages = this.buildMessages(userInput, context);

    for (let iter = 1; iter <= this.maxIterations; iter++) {
      this.onIteration?.(iter, messages);

      // 1. Call LLM
      const thought: string = await this.llmCall.chat(messages);

      // 2. Parse tool call
      const toolCall = this.parser.parse(thought);

      if (!toolCall) {
        // No tool detected — return as final response
        return thought;
      }

      // 3. Execute tool
      let output: string;
      try {
        output = await this.executor.execute(toolCall);
      } catch (err) {
        output = `Tool error: ${err instanceof Error ? err.message : String(err)}`;
      }

      // 4. Append to message history and loop
      messages.push({ role: 'assistant', content: thought });
      messages.push({ role: 'tool', content: output });
    }

    return '⚠️ O processamento excedeu o limite de iterações. Tente uma pergunta mais específica.';
  }

  private buildMessages(userInput: string, context?: string): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const toolPrompt = this.executor['deps'].registry.buildSystemPrompt();

    if (context) {
      messages.push({ role: 'system', content: context + '\n\n' + toolPrompt });
    } else if (toolPrompt) {
      messages.push({ role: 'system', content: toolPrompt });
    }

    messages.push({ role: 'user', content: userInput });
    return messages;
  }
}
