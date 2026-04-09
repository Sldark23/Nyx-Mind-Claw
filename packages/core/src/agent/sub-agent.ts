/**
 * SubAgent — run isolated agent loops for parallel sub-tasks.
 *
 * The parent agent can call tool "subagent" with a task description,
 * and this module handles spawning, running, and collecting results.
 *
 * Usage:
 *   const runner = new SubAgentRunner(llmConfig, toolRegistry);
 *   const result = await runner.spawn('Research X and Y in parallel', { maxIterations: 3 });
 */
import { ProviderFactory, ProviderConfig } from '../llm';
import { ToolRegistry } from '../tools';
import { AgentLoop } from './agent-loop';
import { ChatMessage } from './types';

export interface SubAgentResult {
  output: string;
  iterations: number;
  error?: string;
}

export interface SubAgentOptions {
  maxIterations?: number;
  systemPrompt?: string;
  /** Override the tools available to this sub-agent */
  toolFilter?: string[];
}

export class SubAgentRunner {
  private providerConfig: ProviderConfig;

  constructor(
    providerConfig: ProviderConfig,
    private tools: ToolRegistry
  ) {
    this.providerConfig = providerConfig;
  }

  /**
   * Spawn a sub-agent to handle a task in isolation.
   * The sub-agent gets a fresh message context and its own loop.
   */
  async spawn(task: string, options: SubAgentOptions = {}): Promise<SubAgentResult> {
    const maxIterations = options.maxIterations ?? 5;
    const llm = new ProviderFactory(this.providerConfig);

    // Filter tools if specified
    const tools = options.toolFilter
      ? this.tools.filter(options.toolFilter)
      : this.tools;

    const loop = new AgentLoop({
      llm,
      tools,
      maxIterations,
    });

    const systemPrompt = options.systemPrompt ??
      'You are a helpful assistant. Respond directly and concisely.';

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task },
    ];

    try {
      const output = await loop.runWithMessages(messages);
      return { output, iterations: 1 };
    } catch (err) {
      return {
        output: '',
        iterations: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Spawn multiple sub-agents in parallel and collect results.
   */
  async spawnAll(
    tasks: string[],
    options: SubAgentOptions = {}
  ): Promise<SubAgentResult[]> {
    return Promise.all(tasks.map(task => this.spawn(task, options)));
  }
}
