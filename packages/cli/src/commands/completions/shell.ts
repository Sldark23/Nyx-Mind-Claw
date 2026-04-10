import * as fs from 'fs';

/**
 * Generates shell completion scripts for bash, zsh, and fish.
 */

export type Shell = 'bash' | 'zsh' | 'fish' | 'powershell';

const BASH_COMPLETION = `#!/bin/bash
complete -F _nyxmind nyxmind

_nyxmind() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local prev="\${COMP_WORDS[COMP_CWORD-1]}"

  case "\$prev" in
    nyxmind)
      COMPREPLY=($(compgen -W "init onboard run repl update doctor skills config completions --help --version" -- "$cur"))
      ;;
    skills)
      COMPREPLY=($(compgen -W "list install --help" -- "$cur"))
      ;;
    config)
      COMPREPLY=($(compgen -W "show get set --help" -- "$cur"))
      ;;
    completions)
      COMPREPLY=($(compgen -W "generate install list --help" -- "$cur"))
      ;;
    doctor|init|repl|update)
      COMPREPLY=($(compgen -W "--help" -- "$cur"))
      ;;
    onboard|run)
      COMPREPLY=($(compgen -W "--help" -- "$cur"))
      ;;
    *)
      COMPREPLY=($(compgen -W "--help" -- "$cur"))
      ;;
  esac
}
`;

const ZSH_COMPLETION = `#!/usr/bin/env zsh
(( \${+_nyxmind_commands} )) || _nyxmind_commands=(
  'init:Create .env template'
  'onboard:Interactive onboarding'
  'run:Run the agent'
  'repl:Interactive REPL mode'
  'update:Update NyxMindClaw'
  'doctor:Environment health checks'
  'skills:Manage skills'
  'config:Manage configuration'
)

_nyxmind() {
  local -a commands=(\"\${_nyxmind_commands[@]}\")
  _describe 'command' commands
}

compdef _nyxmind nyxmind
`;

const FISH_COMPLETION = `#!/usr/bin/env fish
complete -c nyxmind -f
complete -c nyxmind -a 'init' -d 'Create .env template'
complete -c nyxmind -a 'onboard' -d 'Interactive onboarding'
complete -c nyxmind -a 'run' -d 'Run the agent'
complete -c nyxmind -a 'repl' -d 'Interactive REPL mode'
complete -c nyxmind -a 'update' -d 'Update NyxMindClaw'
complete -c nyxmind -a 'doctor' -d 'Environment health checks'
complete -c nyxmind -a 'skills' -d 'Manage skills'
complete -c nyxmind -a 'skills list' -d 'List available skills'
complete -c nyxmind -a 'skills install' -d 'Install a skill'
complete -c nyxmind -a 'config' -d 'Manage configuration'
complete -c nyxmind -a 'config show' -d 'Show all config'
complete -c nyxmind -a 'config get' -d 'Get a config value'
complete -c nyxmind -a 'config set' -d 'Set a config value'
complete -c nyxmind -l help -d 'Show help'
complete -c nyxmind -l version -d 'Show version'
`;

const POWERSHELL_COMPLETION = `
Register-ArgumentCompleter -Native -CommandName nyxmind -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)
  $completions = @(
    'init', 'onboard', 'run', 'repl', 'update', 'doctor',
    'skills', 'skills list', 'skills install',
    'config', 'config show', 'config get', 'config set',
    '--help', '--version'
  )
  $completions | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
  }
}
`;

export function generateCompletion(shell: Shell): string {
  switch (shell) {
    case 'bash': return BASH_COMPLETION;
    case 'zsh': return ZSH_COMPLETION;
    case 'fish': return FISH_COMPLETION;
    case 'powershell': return POWERSHELL_COMPLETION;
  }
}

export function getCompletionPath(shell: Shell): string {
  switch (shell) {
    case 'bash': return 'nyxmind.bash';
    case 'zsh': return '_nyxmind';
    case 'fish': return 'nyxmind.fish';
    case 'powershell': return 'nyxmind.ps1';
  }
}

export function installCompletion(shell: Shell): { path: string; content: string } {
  const content = generateCompletion(shell);
  let path = getCompletionPath(shell);

  switch (shell) {
    case 'bash':
      path = `${process.env.HOME}/.bash_completion.d/nyxmind`;
      if (!fs.existsSync(`${process.env.HOME}/.bash_completion.d`)) {
        fs.mkdirSync(`${process.env.HOME}/.bash_completion.d`, { recursive: true });
      }
      break;
    case 'zsh':
      path = `${process.env.HOME}/.zsh/completions/_nyxmind`;
      if (!fs.existsSync(`${process.env.HOME}/.zsh/completions`)) {
        fs.mkdirSync(`${process.env.HOME}/.zsh/completions`, { recursive: true });
      }
      break;
    case 'fish':
      path = `${process.env.HOME}/.config/fish/completions/nyxmind.fish`;
      const fishDir = `${process.env.HOME}/.config/fish`;
      if (!fs.existsSync(fishDir)) {
        fs.mkdirSync(fishDir, { recursive: true });
      }
      const fishCompDir = `${fishDir}/completions`;
      if (!fs.existsSync(fishCompDir)) {
        fs.mkdirSync(fishCompDir, { recursive: true });
      }
      break;
    case 'powershell':
      const psDir = `${process.env.HOME}/Documents/PowerShell`;
      if (!fs.existsSync(psDir)) {
        fs.mkdirSync(psDir, { recursive: true });
      }
      path = `${psDir}/nyxmind_profile.ps1`;
      break;
  }

  return { path, content };
}
