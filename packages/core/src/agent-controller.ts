import { ProviderFactory, ProviderConfig } from './provider';
import { ToolRegistry } from './tools/registry';
import { SkillLoader } from './skills/loader';
import { SkillRouter } from './skills/router';
import { SkillExecutor } from './skills/executor';
import { AgentLoop } from './agent-loop';
import { MemoryManager } from './memory';

export class AgentController {
  private llm: ProviderFactory;
  private tools = new ToolRegistry();
  private loader = new SkillLoader();
  private memory = new MemoryManager();
  private loop: AgentLoop;

  constructor(cfg: ProviderConfig) {
    this.llm = new ProviderFactory(cfg);
    this.loop = new AgentLoop(this.llm, this.tools);
  }

  async handle(userId: string, channel: string, input: string) {
    const convoId = `${channel}:${userId}`;
    if (!this.memory.getConversation(convoId)) {
      this.memory.createConversation(convoId, userId, channel);
    }

    this.memory.addMessage(convoId, 'user', input);

    const skills = this.loader.loadAll();
    const router = new SkillRouter(this.llm);
    const skillName = await router.route(input, skills);

    let output: string;

    if (skillName) {
      const skill = skills.find(s => s.name === skillName);
      if (skill) {
        const executor = new SkillExecutor(this.loop);
        output = await executor.execute(skill, input);
      } else {
        output = await this.loop.run(input);
      }
    } else {
      output = await this.loop.run(input);
    }

    this.memory.addMessage(convoId, 'assistant', output);
    return output;
  }
}
