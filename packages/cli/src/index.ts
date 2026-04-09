#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { registerInitCommand } from './commands/init/index';
import { registerOnboardCommand } from './commands/onboard/index';
import { registerRunCommand } from './commands/run/index';
import { registerReplCommand } from './commands/repl/index';
import { registerUpdateCommand } from './commands/update/index';
import { registerDoctorCommand } from './commands/doctor/index';
import { registerSkillsCommand } from './commands/skills/register';
import { registerConfigCommand } from './commands/config/register';

const program = new Command();

program.name('nyxmind').description('NyxMindClaw CLI').version('0.1.0');

registerInitCommand(program);
registerOnboardCommand(program);
registerRunCommand(program);
registerReplCommand(program);
registerUpdateCommand(program);
registerDoctorCommand(program);
registerSkillsCommand(program);
registerConfigCommand(program);

program.parse(process.argv);
