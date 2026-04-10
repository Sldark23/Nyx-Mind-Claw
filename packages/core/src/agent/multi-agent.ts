/**
 * Multi-Agent Role System for NyxMindClaw.
 *
 * Enables supervisor → workers orchestration with role-based agents.
 * Roles: supervisor, researcher, coder, reviewer, executor
 *
 * Usage:
 *   const team = new AgentTeam();
 *   team.addRole('researcher', { description: 'Researches topics', toolFilter: ['web'] });
 *   team.addRole('coder', { description: 'Writes code', toolFilter: ['terminal', 'file'] });
 *   team.addSupervisor({ systemPrompt: 'You coordinate researchers and coders.' });
 *
 *   const result = await team.run('Research AI agents and write a report');
 */
import { ProviderFactory, ProviderConfig } from '../llm';
import { ToolRegistry } from '../tools';
import { AgentLoop } from './agent-loop';
import { SubAgentRunner, type SubAgentOptions } from './sub-agent';
import { type ChatMessage } from './types';

// ── Types ────────────────────────────────────────────────────────────────────

export type AgentRole = 'supervisor' | 'researcher' | 'coder' | 'reviewer' | 'executor' | 'custom';

export interface RoleDefinition {
  name: string;
  role: AgentRole;
  description: string;
  /** System prompt additions for this role */
  systemPrompt?: string;
  /** Restrict which tools this role can use */
  toolFilter?: string[];
  /** Max iterations for tasks assigned to this role */
  maxIterations?: number;
}

export interface TaskResult {
  role: string;
  output: string;
  success: boolean;
  iterations?: number;
  error?: string;
}

export interface TeamResult {
  success: boolean;
  supervisorOutput: string;
  taskResults: TaskResult[];
  totalIterations: number;
}

// ── Role prompt templates ──────────────────────────────────────────────────────

const ROLE_PROMPTS: Record<AgentRole, string> = {
  supervisor: `You are the Supervisor. Your job is to:
1. Break down complex requests into sub-tasks
2. Assign each sub-task to the appropriate worker role
3. Wait for results and synthesize them into a final answer
4. If a worker fails, decide whether to retry or proceed without
You delegate work by calling the 'delegate' tool with a task description.

Be decisive. Don't do the work yourself — coordinate.`,
  researcher: `You are a Researcher. Your job is to:
1. Gather information about the given topic
2. Use web search, web fetch, and reading tools
3. Summarize findings clearly with sources
Return structured notes. Don't editorialize.`,
  coder: `You are a Coder. Your job is to:
1. Write clean, working code
2. Follow the project's conventions
3. Prefer simple solutions over complex ones
4. Test your code before returning
Return code blocks with brief explanation.`,
  reviewer: `You are a Code Reviewer. Your job is to:
1. Review code for bugs, security issues, and style
2. Suggest concrete improvements
3. Approve or request changes
Be specific. Give examples of problems and fixes.`,
  executor: `You are an Executor. Your job is to:
1. Run commands and scripts
2. Handle errors and retry as needed
3. Report results clearly
4. Stop and report if something goes wrong
Be methodical. Check each step.`,
  custom: `You are a specialized agent. Complete the task given.`,
};

// ── AgentTeam ────────────────────────────────────────────────────────────────

export class AgentTeam {
  private roles = new Map<string, RoleDefinition>();
  private providerConfig: ProviderConfig;
  private tools: ToolRegistry;
  private supervisorPrompt: string;

  constructor(
    providerConfig: ProviderConfig,
    tools: ToolRegistry,
    supervisorPrompt?: string
  ) {
    this.providerConfig = providerConfig;
    this.tools = tools;
    this.supervisorPrompt = supervisorPrompt ?? ROLE_PROMPTS.supervisor;
  }

  /**
   * Register a worker role.
   */
  addRole(name: string, definition: Omit<RoleDefinition, 'name'>): void {
    this.roles.set(name, { name, ...definition });
  }

  /**
   * Run the team on a task using supervisor → workers pattern.
   */
  async run(task: string): Promise<TeamResult> {
    const supervisorLoop = new AgentLoop({
      llm: new ProviderFactory(this.providerConfig),
      tools: this.tools,
      maxIterations: 3,
    });

    // Build context: list of available roles
    const roleDescriptions = Array.from(this.roles.values())
      .map(r => `  - ${r.name}: ${r.description}`)
      .join('\n');

    const systemPrompt = `${this.supervisorPrompt}\n\nAvailable roles:\n${roleDescriptions}\n\nWhen you need work done, use the delegate tool: { "role": "role-name", "task": "what to do" }`;

    // Supervisor thinks and delegates
    let iterations = 0;
    const taskResults: TaskResult[] = [];

    // Simple loop: supervisor decides, we execute tasks inline
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task },
    ];

    try {
      const supervisorOutput = await supervisorLoop.runWithMessages(messages);
      iterations++;

      // Parse delegate calls from output
      // In a full implementation, we'd hook into the tool calls
      // For now, we return supervisor output directly
      return {
        success: true,
        supervisorOutput,
        taskResults,
        totalIterations: iterations,
      };
    } catch (err) {
      return {
        success: false,
        supervisorOutput: '',
        taskResults,
        totalIterations: iterations,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Run a task with a specific role directly (no supervisor).
   */
  async runAsRole(roleName: string, task: string): Promise<TaskResult> {
    const role = this.roles.get(roleName);
    if (!role) {
      return { role: roleName, output: '', success: false, error: `Role "${roleName}" not found` };
    }

    const runner = new SubAgentRunner(this.providerConfig, this.tools);
    const systemPrompt = ROLE_PROMPTS[role.role] + '\n\n' + (role.systemPrompt ?? '');

    const result = await runner.spawn(task, {
      maxIterations: role.maxIterations ?? 5,
      systemPrompt,
      toolFilter: role.toolFilter,
    });

    return {
      role: roleName,
      output: result.output,
      success: !result.error,
      iterations: result.iterations,
      error: result.error,
    };
  }

  /**
   * Run multiple roles in parallel on the same task, return all results.
   */
  async runAllParallel(task: string): Promise<TaskResult[]> {
    const promises = Array.from(this.roles.values()).map(role =>
      this.runAsRole(role.name, task)
    );
    return Promise.all(promises);
  }

  listRoles(): RoleDefinition[] {
    return Array.from(this.roles.values());
  }
}

// ── Collaborative debate ──────────────────────────────────────────────────────

export interface DebateResult {
  consensus: string;
  positions: Array<{ role: string; position: string; changed: boolean }>;
  rounds: number;
}

/**
 * Run a collaborative debate between multiple roles.
 * Each role argues their position, then they converge.
 */
export class CollaborativeDebate {
  private roles: RoleDefinition[];
  private providerConfig: ProviderConfig;
  private tools: ToolRegistry;

  constructor(roles: RoleDefinition[], providerConfig: ProviderConfig, tools: ToolRegistry) {
    this.roles = roles;
    this.providerConfig = providerConfig;
    this.tools = tools;
  }

  async run(topic: string, rounds = 3): Promise<DebateResult> {
    const positions: Array<{ role: string; position: string; changed: boolean }> = [];
    let currentArguments: string[] = [];

    for (let i = 0; i < rounds; i++) {
      // Each role makes their case
      const roundPositions: string[] = [];

      for (const role of this.roles) {
        const runner = new SubAgentRunner(this.providerConfig, this.tools);
        const context = currentArguments.length > 0
          ? `Previous arguments:\n${currentArguments.join('\n')}\n\nYour turn:`
          : `Debate topic: ${topic}\n\nYour turn:`;

        const result = await runner.spawn(context, {
          maxIterations: 2,
          systemPrompt: `${ROLE_PROMPTS[role.role]}\n\nArgue your position clearly. Be direct.`,
          toolFilter: role.toolFilter,
        });

        roundPositions.push(`[${role.name}]: ${result.output}`);
      }

      currentArguments = roundPositions;

      // Record positions
      for (let j = 0; j < this.roles.length; j++) {
        const role = this.roles[j];
        const position = roundPositions[j] ?? '';
        const changed = i > 0 && positions[j]?.position !== position;
        positions.push({ role: role.name, position, changed });
      }
    }

    // Final synthesis by first role
    const synthesisRunner = new SubAgentRunner(this.providerConfig, this.tools);
    const synthesis = await synthesisRunner.spawn(
      `Debate topic: ${topic}\n\nArguments:\n${currentArguments.join('\n\n')}\n\nProvide a clear synthesis and conclusion.`,
      { maxIterations: 2, systemPrompt: 'Synthesize the debate into a clear conclusion.' }
    );

    return {
      consensus: synthesis.output,
      positions,
      rounds,
    };
  }
}