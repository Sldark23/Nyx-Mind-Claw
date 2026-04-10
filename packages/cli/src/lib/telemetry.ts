/**
 * Anonymous telemetry — opt-in via TELEMETRY_ENABLED=true
 *
 * Events written to data_dir/telemetry.jsonl.
 * Optionally POST to TELEMETRY_ENDPOINT (one JSON line per request).
 *
 * Collected: command name, duration, OS, Node version, error type.
 * NO api keys, no prompts, no responses, no PII.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface TelemetryEvent {
  event: 'command_executed' | 'command_completed' | 'error';
  timestamp: string;
  cli_version: string;
  os: NodeJS.Platform;
  node_version: string;
  arch: string;
  command?: string;
  duration_ms?: number;
  error?: string;
  error_message?: string;
  provider?: string;
  model?: string;
}

interface TelemetryConfig {
  enabled: boolean;
  data_dir: string;
  endpoint?: string;
  batch_size: number;
  flush_interval_ms: number;
}

const DEFAULT_CONFIG: TelemetryConfig = {
  enabled: false,
  data_dir: './data',
  batch_size: 10,
  flush_interval_ms: 30_000,
};

let config: TelemetryConfig = { ...DEFAULT_CONFIG };
let buffer: TelemetryEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

export function initTelemetry(): void {
  const telemetryEnabled = process.env.TELEMETRY_ENABLED === 'true';
  config = {
    ...DEFAULT_CONFIG,
    enabled: telemetryEnabled,
    data_dir: process.env.DATA_DIR ?? DEFAULT_CONFIG.data_dir,
    endpoint: process.env.TELEMETRY_ENDPOINT,
    batch_size: parseInt(process.env.TELEMETRY_BATCH_SIZE ?? '', 10) || DEFAULT_CONFIG.batch_size,
    flush_interval_ms: parseInt(process.env.TELEMETRY_FLUSH_INTERVAL_MS ?? '', 10) || DEFAULT_CONFIG.flush_interval_ms,
  };

  if (!config.enabled) return;

  const dir = path.resolve(config.data_dir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  flushTimer = setInterval(() => flush(), config.flush_interval_ms);
}

export function shutdownTelemetry(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  flush();
}

function baseEvent(): Omit<TelemetryEvent, 'event'> {
  return {
    timestamp: new Date().toISOString(),
    cli_version: '0.1.0',
    os: os.platform(),
    node_version: process.version,
    arch: os.arch(),
  };
}

export function trackCommandExecuted(command: string, provider?: string, model?: string): void {
  if (!config.enabled) return;
  push({
    ...baseEvent(),
    event: 'command_executed',
    command,
    provider,
    model,
  });
}

export function trackCommandCompleted(command: string, duration_ms: number, provider?: string, model?: string): void {
  if (!config.enabled) return;
  push({
    ...baseEvent(),
    event: 'command_completed',
    command,
    duration_ms,
    provider,
    model,
  });
}

export function trackError(command: string, error: string, error_message?: string): void {
  if (!config.enabled) return;
  push({
    ...baseEvent(),
    event: 'error',
    command,
    error,
    error_message,
  });
}

function push(event: TelemetryEvent): void {
  buffer.push(event);
  if (buffer.length >= config.batch_size) {
    flush();
  }
}

function flush(): void {
  if (buffer.length === 0) return;
  const events = buffer.splice(0, buffer.length);

  // Always write to local file
  const filePath = path.join(path.resolve(config.data_dir), 'telemetry.jsonl');
  const line = events.map(e => JSON.stringify(e)).join('\n') + '\n';
  fs.appendFileSync(filePath, line);

  // If endpoint configured, POST non-blocking
  if (config.endpoint) {
    const payload = events.map(e => JSON.stringify(e)).join('\n');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      signal: controller.signal,
    }).catch(() => {}).finally(() => clearTimeout(timeout));
  }
}

/**
 * Wrap a commander action to track execution time and errors.
 * Usage: .action(withTelemetry('command-name', async (...args) => { ... }))
 */
export function withTelemetry<T extends (...args: unknown[]) => unknown>(
  commandName: string,
  fn: T
): (...args: Parameters<T>) => Promise<void> {
  return async (...args: Parameters<T>): Promise<void> => {
    const start = Date.now();
    try {
      trackCommandExecuted(commandName);
      await fn(...args);
    } catch (err) {
      const e = err as Error;
      trackError(commandName, e.constructor.name, e.message);
      throw err;
    } finally {
      const ms = Date.now() - start;
      if (ms > 100) {
        trackCommandCompleted(commandName, ms);
      }
    }
  };
}
