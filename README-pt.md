# Nyx-Mind-Claw

Seu framework de agente AI pessoal — extensível, multi-provedor, orientado a skills.

## Começo Rápido

```bash
npm install
npm run build
nyxmind onboard    # Setup interativo
nyxmind run        # Iniciar o agente
```

## Funcionalidades

- **Multi-Provedor LLM**: OpenAI, Groq, Anthropic, Gemini, DeepSeek, Ollama, MiniMax, Grok
- **Sistema de Skills**: Skills bundled carregam automático; skills externas passam por verificação
- **Canais**: Telegram, Discord, WhatsApp
- **CLI-first**: `nyxmind onboard`, `nyxmind run`, `nyxmind skills`, `nyxmind doctor`
- **Config**: `nyxmind-claw.json` (prioridade) ou fallback `.env`

## Comandos

| Comando | Descrição |
|---|---|
| `nyxmind onboard` | Setup interativo |
| `nyxmind run` | Iniciar o agente |
| `nyxmind skills` | Listar skills instaladas |
| `nyxmind skills install <nome>` | Instalar skill do marketplace |
| `nyxmind doctor` | Checagem de saúde |
| `nyxmind --help` | Mostrar todos os comandos |

## Arquitetura

```
nyxmind-claw/
├── packages/
│   ├── cli/          # Interface de linha de comando nyxmind
│   └── core/         # Agent loop, factory LLM, memória, skills, config
├── .agents/skills/   # Skills instaladas (arquivos SKILL.md)
├── nyxmind-claw.json # Arquivo de config (ou use .env)
└── install.sh        # Script de auto-instalação
```

## Skills

Skills bundled (pré-aprovadas):
- `brain-sync` — Sincroniza notas entre vault Obsidian e serviços externos
- `proactivity` — Anticipa necessidades, mantém o trabalho fluindo
- `autoresearch` — Pesquisa profunda sobre qualquer assunto
- `article-builder-news` — Gera e publica artigos de notícias no WordPress
- `humanizer` — Remove padrões de escrita AI de textos

Skills externas são verificadas quanto a vazamento de credenciais antes de serem ativadas.

## Contribuindo

1. Fork o repo
2. Crie uma branch: `git checkout -b feature/minha-feature`
3. Commit: `git commit -m 'feat: add minha feature'`
4. Push: `git push origin feature/minha-feature`
5. Abra um PR
