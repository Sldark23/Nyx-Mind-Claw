import 'dotenv/config';
import { ProviderFactory, configFromEnv, ProviderConfig } from '../llm';
import { ToolRegistry } from '../tools';
import { SkillLoader } from '../skills/loader';
import { SkillRouter } from '../skills/router';
import { SkillExecutor } from '../skills/executor';
import { AgentLoop } from './agent-loop';
import { MemoryManager } from '../memory';
import { ChannelType } from './types';

const ALLOWED_USER_IDS = (process.env.ALLOWED_USER_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const MAX_ITERATIONS = parseInt(process.env.MAX_ITERATIONS || '5', 10);

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

  constructor(cfg?: ProviderConfig) {
    const config = cfg || configFromEnv();
    this.llm = new ProviderFactory(config);
    this.tools = new ToolRegistry();
    this.loader = new SkillLoader();
    this.memory = new MemoryManager();
    this.router = new SkillRouter(this.llm);
    this.loop = new AgentLoop({ llm: this.llm, tools: this.tools, maxIterations: MAX_ITERATIONS });
  }

  isWhitelisted(userId: string): boolean {
    if (ALLOWED_USER_IDS.length === 0) return true;
    return ALLOWED_USER_IDS.includes(userId);
  }

  checkRateLimit(userId: string, limit = 20, windowMs = 60000): boolean {
    const now = Date.now();
    const entry = this.rateLimitMap.get(userId);

    if (!entry || now > entry.resetAt) {
      this.rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (entry.count >= limit) {
      return false;
    }

    entry.count++;
    return true;
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

    this.memory.addMessage(convoId, 'user', input);

    const skills = this.loader.loadAll();
    let output: string;

    if (skills.length > 0) {
      const skillName = await this.router.route(input, skills);
      if (skillName) {
        const skill = skills.find(s => s.name === skillName);
        if (skill) {
          console.log(`[Controller:skill] Routed to skill="${skillName}"`);
          const executor = new SkillExecutor(this.loop);
          output = await executor.execute(skill, input);
        } else {
          output = await this.loop.run(input, this.tools.buildSystemPrompt());
        }
      } else {
        output = await this.loop.run(input, this.tools.buildSystemPrompt());
      }
    } else {
      output = await this.loop.run(input, this.tools.buildSystemPrompt());
    }

    this.memory.addMessage(convoId, 'assistant', output);
    return { output };
  }

  getMemory(): MemoryManager {
    return this.memory;
  }

  getTools(): ToolRegistry {
    return this.tools;
  }
}