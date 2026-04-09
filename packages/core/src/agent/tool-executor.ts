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

    switch (call.tool) {
      case 'shell':
        return registry.shell(call.args.command as string);

      case 'read_file':
        return registry.readFile(call.args.path as string);

      case 'write_file':
        return registry.writeFile(
          call.args.path as string,
          call.args.content as string
        );

      case 'web_search':
        return registry.searchWeb(call.args.query as string);

      case 'web_fetch':
        return registry.fetchUrl(call.args.url as string);

      default:
        return `Unknown tool: "${call.tool}". Available tools: shell, read_file, write_file, web_search, web_fetch`;
    }
  }
}
