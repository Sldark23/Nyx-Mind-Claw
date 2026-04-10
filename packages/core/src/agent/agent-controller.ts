import { ProviderFactory, configFromEnv, ProviderConfig } from '../llm';
import { ToolRegistry } from '../tools';
import { SkillLoader, SkillMeta } from '../skills/loader';
import { SkillRouter } from '../skills/router';
import { SkillExecutor } from '../skills/executor';
import { AgentLoop } from './agent-loop';
import { MemoryManager } from '../memory';
import { ChannelType } from './types';
import { SkillRegistry, getRegistry } from '../skills/verifier';
import { getConfig, type ApprovalConfig } from '../config';
import { ApprovalManager } from '../config/manager';
import {
  nextBootstrapQuestion,
  buildBootstrapPrompt,
  buildBootstrapAnswerPrompt,
  BOOTSTRAP_QUESTIONS,
  type BootstrapAnswers,
} from './bootstrap';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class AgentController {
  private llm: ProviderFactory;
  private tools: ToolRegistry;
  private loader: SkillLoader;
  private memory: MemoryManager;
  private loop: AgentLoop;
  private router: SkillRouter;
  private rateLimitMap = new Map<string, RateLimitEntry>();
  private approvalManager: ApprovalManager;
  // Bootstrap state per user: null = not in bootstrap, pending key = awaiting answer
  private bootstrapState = new Map<string, keyof BootstrapAnswers | 'confirming' | null>();

  constructor(cfg?: ProviderConfig) {
    const cfg_ = cfg || configFromEnv();
    const fullConfig = getConfig();
    this.llm = new ProviderFactory(cfg_);
    this.tools = new ToolRegistry();
    this.loader = new SkillLoader();
    this.memory = new MemoryManager();
    this.router = new SkillRouter(this.llm);
    this.loop = new AgentLoop({ llm: this.llm, tools: this.tools, maxIterations: fullConfig.iterations });
    this.approvalManager = new ApprovalManager();
  }

  isWhitelisted(userId: string): boolean {
    const allowedUserIds = getConfig().limits.allowedUserIds;
    if (allowedUserIds.length === 0) return true;
    return allowedUserIds.includes(userId);
  }

  checkRateLimit(userId: string, limit?: number, windowMs = 60000): boolean {
    const rateLimit = limit ?? getConfig().limits.rateLimitPerMinute;
    const now = Date.now();
    const entry = this.rateLimitMap.get(userId);

    if (!entry || now > entry.resetAt) {
      this.rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (entry.count >= rateLimit) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Check if a tool requires approval.
   * Returns { approved, requiresConfirmation } based on config mode and tool name.
   * Tools matching dangerousTools patterns always need approval.
   */
  checkApproval(toolName: string): { approved: boolean; requiresConfirmation: boolean } {
    const cfg = getConfig().approval as ApprovalConfig | undefined;
    if (!cfg) {
      return { approved: true, requiresConfirmation: false };
    }

    const { mode, dangerousTools, requireApprovalFor } = cfg;

    // Helper: match a tool name against a list of glob-like patterns
    const matches = (tool: string, patterns: string[]): boolean => {
      return patterns.some(pattern => {
        if (pattern === tool) return true;
        if (pattern.endsWith('*')) {
          const prefix = pattern.slice(0, -1);
          return tool.startsWith(prefix);
        }
        if (pattern.startsWith('*')) {
          const suffix = pattern.slice(1);
          return tool.endsWith(suffix);
        }
        return false;
      });
    };

    const isDangerous = matches(toolName, dangerousTools);
    const requiresApproval = isDangerous || matches(toolName, requireApprovalFor);

    switch (mode) {
      case 'auto':
        return { approved: true, requiresConfirmation: false };

      case 'manual':
        if (requiresApproval) {
          const approved = this.approvalManager.isApproved(toolName);
          if (!approved) {
            this.approvalManager.addPending(toolName);
          }
          return { approved, requiresConfirmation: !approved };
        }
        return { approved: true, requiresConfirmation: false };

      case 'confirmation':
        if (requiresApproval) {
          const approved = this.approvalManager.isApproved(toolName);
          if (!approved) {
            this.approvalManager.addPending(toolName);
            return { approved: false, requiresConfirmation: true };
          }
          return { approved: true, requiresConfirmation: false };
        }
        return { approved: true, requiresConfirmation: false };

      default:
        return { approved: true, requiresConfirmation: false };
    }
  }

  /**
   * Check if user needs bootstrap (profile incomplete or new user).
   * Returns null if bootstrap not needed.
   */
  private getBootstrapQuestion(userId: string): { key: keyof BootstrapAnswers; question: string } | null {
    const profile = this.memory.getBootstrapProfile(userId);
    if (!profile) return null; // No profile yet — trigger bootstrap start
    const next = nextBootstrapQuestion(profile.answers);
    if (next) this.bootstrapState.set(userId, next.key);
    return next;
  }

  /**
   * Resolve the user's answer to the current bootstrap question.
   * Returns null if the answer is valid and saved (ready for next question).
   * Returns a clarifying question if the answer needs more clarity.
   */
  private async resolveBootstrapAnswer(
    userId: string,
    currentKey: keyof BootstrapAnswers,
    answer: string
  ): Promise<{ saved: true; next: { key: keyof BootstrapAnswers; question: string } | null } | { saved: false; retry: string }> {
    const cleanAnswer = answer.trim();
    if (!cleanAnswer) {
      return { saved: false, retry: 'Não entendi, pode repetir?' };
    }
    this.memory.saveBootstrapAnswer(userId, currentKey, cleanAnswer);
    const profile = this.memory.getBootstrapProfile(userId);
    const next = profile ? nextBootstrapQuestion(profile.answers) : null;
    if (!next) {
      this.memory.completeBootstrap(userId);
      this.bootstrapState.delete(userId);
    } else {
      this.bootstrapState.set(userId, next.key);
    }
    return { saved: true, next };
  }

  async handle(
    userId: string,
    channel: ChannelType,
    input: string
  ): Promise<{ output: string; blocked?: boolean; reason?: string }> {
    if (!this.isWhitelisted(userId)) {
      console.warn(`[Controller:auth] User ${userId} not whitelisted, rejected.`);
      return { output: 'Acesso negado.', blocked: true, reason: 'not_whitelisted' };
    }

    if (!this.checkRateLimit(userId)) {
      console.warn(`[Controller:rate-limit] User ${userId} exceeded rate limit.`);
      return { output: 'Calma aí, muitas mensagens! Tenta novamente em alguns minutos.', blocked: true, reason: 'rate_limited' };
    }

    const convoId = `${channel}:${userId}`;

    if (!this.memory.getConversation(convoId)) {
      this.memory.createConversation(convoId, userId, channel);
    }

    // ── Bootstrap flow ────────────────────────────────────────────────────
    const bootstrapKey = this.bootstrapState.get(userId);
    const profile = this.memory.getBootstrapProfile(userId);

    if (!profile) {
      // First time — start bootstrap
      this.bootstrapState.set(userId, 'confirming');
      const locale = getConfig().locale;
      const greeting = locale.startsWith('pt')
        ? 'Olá! Vamos nos conhecer. '
        : 'Hi! Let\'s get to know each other. ';
      const firstQ = BOOTSTRAP_QUESTIONS[0];
      this.bootstrapState.set(userId, firstQ.key);
      return { output: greeting + firstQ.question };
    }

    if (bootstrapKey && bootstrapKey !== 'confirming') {
      // Awaiting answer to a bootstrap question
      const result = await this.resolveBootstrapAnswer(userId, bootstrapKey, input);
      if (!result.saved) {
        return { output: result.retry };
      }
      if (result.next) {
        return { output: result.next.question };
      }
      // Bootstrap complete!
      this.bootstrapState.delete(userId);
      const agentName = profile.answers.agentName ?? 'NyxMindClaw';
      const userName = profile.answers.userName ?? 'friend';
      const locale = getConfig().locale;
      const done = locale.startsWith('pt')
        ? `Perfeito, ${userName}! Tudo configurado. Sou ${agentName}, vamos lá!`
        : `Perfect, ${userName}! All set. I'm ${agentName}, let's go!`;
      return { output: done };
    }

    // ── Normal flow ───────────────────────────────────────────────────────
    this.memory.addMessage(convoId, 'user', input);

    // Inject graph memory context into system prompt
    const memoryContext = this.memory.buildMemoryContext(input);
    const systemPrompt = this.tools.buildSystemPrompt() + (memoryContext ? `\n\n${memoryContext}` : '');

    const allSkills = this.loader.loadAll();
    const registry = getRegistry();
    const approvedSkills = allSkills.filter(s => registry.isApproved(s.name));

    let output: string;
    if (approvedSkills.length > 0) {
      const skillName = await this.router.route(input, approvedSkills);
      if (skillName) {
        const skill = approvedSkills.find(s => s.name === skillName);
        if (skill) {
          console.log(`[Controller:skill] Routed to skill="${skillName}"`);
          const executor = new SkillExecutor(this.loop);
          output = await executor.execute(skill, input);
        } else {
          output = await this.loop.run(input, systemPrompt);
        }
      } else {
        output = await this.loop.run(input, systemPrompt);
      }
    } else {
      output = await this.loop.run(input, systemPrompt);
    }

    this.memory.addMessage(convoId, 'assistant', output);

    // Store interaction in graph memory for future recall
    this.memory.addInteraction(convoId, userId, input, output);

    return { output };
  }

  getMemory(): MemoryManager {
    return this.memory;
  }

  getTools(): ToolRegistry {
    return this.tools;
  }

  getApprovalManager(): ApprovalManager {
    return this.approvalManager;
  }
}