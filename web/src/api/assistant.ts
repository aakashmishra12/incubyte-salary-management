import { api } from './client.ts';

export type ProviderState = 'ready' | 'cooling_down' | 'daily_limit_reached' | 'misconfigured';

export interface AssistantStatus {
  enabled: boolean;
  providers: { id: string; label: string; state: ProviderState; availableAgainAt?: string }[];
  limits: { perVisitorPerHour: number } | null;
}

export interface AssistantAnswer {
  answer: string;
  /** What the answer was based on, so a person can check it. */
  sources: string[];
  provider: string | null;
  providerLabel: string | null;
  /** True when the answer was remembered and no model was used. */
  cached: boolean;
  remainingThisHour: number;
}

export interface AssistantQuestion {
  question: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  /** Left out for Auto, where the server picks and switches providers itself. */
  provider?: string | undefined;
}

export function fetchAssistantStatus(): Promise<AssistantStatus> {
  return api<AssistantStatus>('/api/assistant/status');
}

export function askAssistant(question: AssistantQuestion): Promise<AssistantAnswer> {
  return api<AssistantAnswer>('/api/assistant/ask', { method: 'POST', body: question });
}
