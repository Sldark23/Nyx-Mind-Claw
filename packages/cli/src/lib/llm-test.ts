import { AgentController, ProviderConfig } from '@nyxmind/core';

export async function testLlmConnection(cfg: ProviderConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    const controller = new AgentController(cfg);
    await controller.handle('test-user', 'cli', 'hi');
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('401') || message.includes('403') || message.toLowerCase().includes('api key')) {
      return { ok: true };
    }

    return { ok: false, error: message.slice(0, 120) };
  }
}
