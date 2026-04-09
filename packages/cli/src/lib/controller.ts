import { AgentController } from '@nyxmind/core';
import { getProviderConfigFromEnv } from './provider';

export function createControllerFromEnv(): AgentController {
  return new AgentController(getProviderConfigFromEnv());
}
