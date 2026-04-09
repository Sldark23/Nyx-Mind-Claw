#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { registerInitCommand } from './commands/init';
import { registerOnboardCommand } from './commands/onboard';
import { registerRunCommand } from './commands/run';
import { registerReplCommand } from './commands/repl';

const program = new Command();

program.name('nyxmind').description('NyxMindClaw CLI').version('0.1.0');

registerInitCommand(program);
registerOnboardCommand(program);
registerRunCommand(program);
registerReplCommand(program);

program.parse(process.argv);
