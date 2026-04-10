# Nyx-Mind-Claw

Ваш персональный AI-агент фреймворк — расширяемый, мульти-провайдер, навыковый.

## Быстрый Старт

```bash
npm install
npm run build
nyxmind onboard    # Интерактивная настройка
nyxmind run        # Запустить агента
```

## Ключевые Возможности

- **Мульти-LLM Провайдер**: OpenAI, Groq, Anthropic, Gemini, DeepSeek, Ollama, MiniMax, Grok
- **Система Навыков**: Встроенные навыки загружаются автоматически; внешние проходят верификацию
- **Каналы**: Telegram, Discord, WhatsApp
- **CLI-first**: `nyxmind onboard`, `nyxmind run`, `nyxmind skills`, `nyxmind doctor`
- **Конфиг**: `nyxmind-claw.json` (приоритет) или `.env` fallback

## Команды

| Команда | Описание |
|---|---|
| `nyxmind onboard` | Интерактивная настройка |
| `nyxmind run` | Запустить агента |
| `nyxmind skills` | Список установленных навыков |
| `nyxmind skills install <name>` | Установить навык из маркетплейса |
| `nyxmind doctor` | Проверка здоровья |
| `nyxmind --help` | Показать все команды |

## Архитектура

```
nyxmind-claw/
├── packages/
│   ├── cli/          # CLI интерфейс nyxmind
│   └── core/         # Agent loop, LLM factory, память, навыки, конфиг
├── .agents/skills/   # Установленные навыки (файлы SKILL.md)
├── nyxmind-claw.json # Файл конфигурации (или используйте .env)
└── install.sh        # Скрипт авто-установки
```

## Навыки (Skills)

Встроенные навыки (предварительно одобрены):
- `brain-sync` — Синхронизация заметок между Obsidian vault и внешними сервисами
- `proactivity` — Предвосхищает потребности, поддерживает работу
- `autoresearch` — Глубокое исследование любой темы
- `article-builder-news` — Генерация и публикация новостей в WordPress
- `humanizer` — Удаление AI-паттернов из текстов

Внешние навыки проверяются на утечку учетных данных перед активацией.

## Вклад

1. Fork репозитория
2. Создайте ветку: `git checkout -b feature/my-feature`
3. Commit: `git commit -m 'feat: add my feature'`
4. Push: `git push origin feature/my-feature`
5. Откройте PR
