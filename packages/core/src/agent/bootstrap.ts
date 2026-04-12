/**
 * Bootstrap system — runs on first conversation per user.
 * Asks identity questions, stores profile in agent_profile table.
 */

export interface BootstrapAnswers {
  // "Quem é você?" — agent's own identity (agentName, agentVibe)
  agentName?: string;
  agentVibe?: string;

  // "Quem é eu?" — user's identity
  userName?: string;
  userTimezone?: string;
  userVibe?: string;

  // "Qual é o teu timezone?"
  agentTimezone?: string;

  // "O que eu sou?" — user's role/description
  userRole?: string;
}

/** Reason why a bootstrap answer is invalid, keyed by field. */
export type BootstrapValidationError = {
  [K in keyof BootstrapAnswers]?: string;
};

const MAX_STRING_LENGTH = 80;
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 40;
const MIN_ROLE_LENGTH = 2;
const MAX_ROLE_LENGTH = 60;
const MIN_VIBE_LENGTH = 2;
const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} .,'’_-]*$/u;
const ROLE_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} .,'’_\-/()&+]*$/u;

// IANA timezone validation — cheap check using Intl.DateTimeFormat
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function validateName(value: string, label: string): string | undefined {
  if (value.length < MIN_NAME_LENGTH) return `${label} must be at least ${MIN_NAME_LENGTH} characters`;
  if (value.length > MAX_NAME_LENGTH) return `${label} must be at most ${MAX_NAME_LENGTH} characters`;
  if (!NAME_PATTERN.test(value)) return `${label} contains unsupported characters`;
  return undefined;
}

function validateRole(value: string): string | undefined {
  if (value.length < MIN_ROLE_LENGTH) return `Role must be at least ${MIN_ROLE_LENGTH} characters`;
  if (value.length > MAX_ROLE_LENGTH) return `Role must be at most ${MAX_ROLE_LENGTH} characters`;
  if (!ROLE_PATTERN.test(value)) return 'Role contains unsupported characters';
  return undefined;
}

/**
 * Validate a single bootstrap answer value.
 * Returns an error message string if invalid, undefined if valid.
 */
export function validateBootstrapAnswer(
  key: keyof BootstrapAnswers,
  value: string
): string | undefined {
  if (!value || typeof value !== 'string') return 'Answer is required';
  const trimmed = value.trim();
  if (!trimmed) return 'Answer is required';
  if (trimmed.length > MAX_STRING_LENGTH) return `Max ${MAX_STRING_LENGTH} characters`;

  switch (key) {
    case 'agentTimezone':
    case 'userTimezone':
      if (!isValidTimezone(trimmed)) return 'Invalid timezone (e.g. America/Sao_Paulo, UTC)';
      break;
    case 'userName':
      return validateName(trimmed, 'User name');
    case 'agentName':
      return validateName(trimmed, 'Agent name');
    case 'userRole':
      return validateRole(trimmed);
    case 'userVibe':
    case 'agentVibe':
      // Free-form but must be reasonable
      if (trimmed.length < MIN_VIBE_LENGTH) return 'Please be more specific';
      break;
    default:
      break;
  }
  return undefined;
}

/**
 * Validate all answers in a BootstrapAnswers object.
 * Returns an object with field-level error messages (empty if all valid).
 */
export function validateBootstrapProfile(
  answers: Partial<BootstrapAnswers>
): BootstrapValidationError {
  const errors: BootstrapValidationError = {};
  for (const key of Object.keys(answers) as (keyof BootstrapAnswers)[]) {
    const val = answers[key];
    if (typeof val === 'string') {
      const err = validateBootstrapAnswer(key, val);
      if (err) errors[key] = err;
    }
  }
  return errors;
}

export interface BootstrapProfile {
  version: number;
  completedAt?: string;
  answers: BootstrapAnswers;
}

const BOOTSTRAP_VERSION = 1;

// ── Bootstrap questions (in order) ────────────────────────────────────────────

export const BOOTSTRAP_QUESTIONS: { key: keyof BootstrapAnswers; question: string }[] = [
  {
    key: 'userName',
    question: 'Pra começar, me diz teu nome:',
  },
  {
    key: 'userRole',
    question: 'O que você faz? (dev, designer, entrepreneur...)',
  },
  {
    key: 'userTimezone',
    question: 'Qual teu timezone? (ex: America/Sao_Paulo, Europe/Lisbon)',
  },
  {
    key: 'userVibe',
    question: 'Qual é a tua vibe? (ex: pragmático, criativo, analítico, relaxed)',
  },
  {
    key: 'agentName',
    question: 'Como quer me chamar? (meu nome)',
  },
  {
    key: 'agentVibe',
    question: 'Como quer que eu seja? (ex: direto, prestativo, bromístico)',
  },
  {
    key: 'agentTimezone',
    question: 'Em qual timezone eu devo operar? (ex: America/Sao_Paulo, UTC)',
  },
];

/**
 * Return the first unanswered question for a given profile.
 * Returns null when all questions are answered.
 */
export function nextBootstrapQuestion(profile: Partial<BootstrapAnswers>): {
  key: keyof BootstrapAnswers;
  question: string;
} | null {
  for (const { key, question } of BOOTSTRAP_QUESTIONS) {
    if (!profile[key]) {
      return { key, question };
    }
  }
  return null;
}

export function buildBootstrapPrompt(
  profile: Partial<BootstrapAnswers>,
  locale = 'en'
): string {
  const next = nextBootstrapQuestion(profile);

  if (!next) {
    // All done — greet with stored profile
    const name = profile.userName ?? 'friend';
    const agentName = profile.agentName ?? 'NyxMindClaw';
    const vibe = profile.agentVibe ?? 'helpful';
    return `You are ${agentName}. Your vibe is: ${vibe}. The user is ${name}. This is a fresh conversation — greet them warmly but briefly.`;
  }

  const { question } = next;
  const lang = locale.startsWith('pt') ? 'pt' : locale.startsWith('es') ? 'es' : 'en';

  if (lang === 'pt') {
    return `Você é ${profile.agentName ?? 'NyxMindClaw'}. Faça a pergunta a seguir de forma breve e casual: "${question}"`;
  }
  if (lang === 'es') {
    return `Eres ${profile.agentName ?? 'NyxMindClaw'}. Haz la siguiente pregunta de forma breve y casual: "${question}"`;
  }
  return `You are ${profile.agentName ?? 'NyxMindClaw'}. Ask the following question briefly and casually: "${question}"`;
}

export function buildBootstrapAnswerPrompt(
  key: keyof BootstrapAnswers,
  answer: string,
  locale = 'en'
): string {
  const lang = locale.startsWith('pt') ? 'pt' : locale.startsWith('es') ? 'es' : 'en';
  const agentName = 'NyxMindClaw';

  if (lang === 'pt') {
    return `Você é ${agentName}. O usuário respondeu: "${answer}" para a pergunta sobre "${key}".` +
      ` Se a resposta for válida, confirme brevemente e diga "PRONTO" para eu salvar.` +
      ` Se não entendi, peça correção de forma breve.`;
  }
  return `You are ${agentName}. The user responded: "${answer}" to the question about "${key}".` +
    ` If the answer is valid, confirm briefly and say "PRONTO" so I can save it.` +
    ` If unclear, ask for clarification briefly.`;
}
