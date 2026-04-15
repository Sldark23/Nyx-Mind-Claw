/**
 * Execute a parsed tool call against the ToolRegistry.
 * Returns the tool output as string, or an error message.
 */
import { ToolCall } from './types';
import { ToolRegistry } from '../tools';

export interface ToolExecutorDeps {
  registry: ToolRegistry;
}

export class ToolExecutor {
  constructor(private deps: ToolExecutorDeps) {}

  async execute(call: ToolCall): Promise<string> {
    const { registry } = this.deps;
    const correlationId = call.correlationId ?? crypto.randomUUID();

    try {
      return await registry.execute(call.tool, call.args as Record<string, unknown>);
    } catch (err: any) {
      return `Tool error [${correlationId}]: ${err.message}`;
    }
  }
}
