import type { ProviderId } from './types.ts';

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  baseUrl: string;
  /** Local Ollama needs no key. */
  apiKey?: string | undefined;
  model: string;
  dailyLimit?: number | undefined;
  /** Settings only this provider understands. */
  extraBody?: Record<string, unknown> | undefined;
}

export interface AssistantConfig {
  providers: ProviderConfig[];
  limits: { perVisitorPerHour: number; perDay: number };
  /** One line for the start-up log. It never contains a key. */
  describe(): string;
}

/** What is known about each provider. A provider is only used if the environment turns it on. */
const KNOWN_PROVIDERS = {
  gemini: {
    label: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyVariable: 'GEMINI_API_KEY',
    modelVariable: 'GEMINI_MODEL',
    // Tested with a live key. The free tier allows 20 requests a day on the main Flash
    // models, so the budget stays just under that. Raise it if billing is set up.
    defaultModel: 'gemini-3.5-flash',
    limitVariable: 'GEMINI_DAILY_LIMIT',
    defaultDailyLimit: 18,
    // Gemini 3 thinks before it answers, and the thinking counts towards the token limit.
    // Low effort is quicker and leaves room for the answer.
    extraBody: { reasoning_effort: 'low' },
  },
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyVariable: 'GROQ_API_KEY',
    modelVariable: 'GROQ_MODEL',
    // Checked against Groq's model list with a live key: answers in well under a second
    // and supports tools. Model names change, so check the list when setting up a key.
    defaultModel: 'openai/gpt-oss-120b',
    limitVariable: 'GROQ_DAILY_LIMIT',
    defaultDailyLimit: 500,
    extraBody: undefined,
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyVariable: 'OPENROUTER_API_KEY',
    modelVariable: 'OPENROUTER_MODEL',
    // A router that picks a free model which supports tools.
    defaultModel: 'openrouter/free',
    limitVariable: 'OPENROUTER_DAILY_LIMIT',
    // The free tier allows 50 requests a day. Staying under it leaves room for slips.
    defaultDailyLimit: 45,
    extraBody: undefined,
  },
  nvidia: {
    label: 'NVIDIA',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    keyVariable: 'NVIDIA_API_KEY',
    modelVariable: 'NVIDIA_MODEL',
    // Not checked with a live key yet. Check build.nvidia.com for a model that supports tools.
    defaultModel: 'nvidia/nemotron-3-super-120b',
    limitVariable: 'NVIDIA_DAILY_LIMIT',
    // NVIDIA's free access is limited per minute (about 40) rather than per day. This budget is
    // a safety margin of ours, since its free terms are for trying things out.
    defaultDailyLimit: 200,
    extraBody: undefined,
  },
  ollama: {
    label: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    keyVariable: undefined,
    modelVariable: 'OLLAMA_MODEL',
    defaultModel: undefined,
    limitVariable: undefined,
    defaultDailyLimit: undefined,
    extraBody: undefined,
  },
} as const;

// Groq first: live tests showed it answering in under half a second with a large daily allowance.
const DEFAULT_ORDER: ProviderId[] = ['groq', 'gemini', 'openrouter', 'nvidia', 'ollama'];

/** A positive whole number from the environment, or the fallback if it is missing or wrong. */
function positiveInteger(text: string | undefined, fallback: number): number {
  const value = Number(text);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/** Reads the assistant settings. `env` is passed in so tests do not depend on the machine. */
export function loadAssistantConfig(env: Record<string, string | undefined>): AssistantConfig {
  const order = env.ASSISTANT_PROVIDERS
    ? env.ASSISTANT_PROVIDERS.split(',')
        .map((name) => name.trim())
        .filter((name): name is ProviderId => name in KNOWN_PROVIDERS)
    : DEFAULT_ORDER;

  const providers: ProviderConfig[] = [];
  for (const id of order) {
    const known = KNOWN_PROVIDERS[id];
    const apiKey = known.keyVariable ? env[known.keyVariable]?.trim() : undefined;
    const model = env[known.modelVariable]?.trim() || known.defaultModel;

    // On with a key, or for the local model, with a model name. Otherwise off.
    const isOn = known.keyVariable ? Boolean(apiKey) : Boolean(model);
    if (!isOn || !model) continue;

    providers.push({
      id,
      label: known.label,
      baseUrl: known.baseUrl,
      apiKey: apiKey || undefined,
      model,
      dailyLimit:
        known.limitVariable && known.defaultDailyLimit
          ? positiveInteger(env[known.limitVariable], known.defaultDailyLimit)
          : undefined,
      extraBody: known.extraBody,
    });
  }

  return {
    providers,
    limits: {
      perVisitorPerHour: positiveInteger(env.ASSISTANT_PER_VISITOR_PER_HOUR, 20),
      perDay: positiveInteger(env.ASSISTANT_PER_DAY, 300),
    },
    describe: () =>
      providers.length > 0
        ? `Assistant providers: ${providers.map((p) => p.label).join(', ')}`
        : 'Assistant is off (no provider key set)',
  };
}
