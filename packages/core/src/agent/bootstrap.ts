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
