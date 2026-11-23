/** The providers this app knows how to talk to. */
export type ProviderId = 'groq' | 'openrouter' | 'ollama';

/** One tool call the model asked for. `arguments` is the raw JSON text the model wrote. */
export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

/**
 * A message in a conversation, in this app's own shape. The provider client converts it
 * to the OpenAI-style format, so nothing else in the app knows that format.
 */
export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; content: string };

export interface ToolDefinition {
  name: string;
  description: string;
  /** A JSON Schema object describing the arguments. */
  parameters: Record<string, unknown>;
}

export interface ModelRequest {
  messages: ChatMessage[];
  tools: ToolDefinition[];
  maxTokens: number;
}

export interface ModelReply {
  content: string | null;
  toolCalls: ToolCall[];
}

/** Anything that can answer a ModelRequest: a real provider, or a fake in a test. */
export interface ModelClient {
  readonly id: ProviderId;
  readonly label: string;
  complete(request: ModelRequest): Promise<ModelReply>;
}

/**
 * Why a provider call failed, in the terms the rest of the app needs:
 * - rate_limited: wait and try again, or use another provider.
 * - unavailable: down, slow or answering nonsense. Try again soon, or use another.
 * - misconfigured: the key or the model name is wrong. Retrying will not help.
 * The message is fixed text. It never contains the key or anything the provider sent.
 */
export class ProviderError extends Error {
  readonly kind: 'rate_limited' | 'unavailable' | 'misconfigured';
  readonly retryAfterSeconds: number | undefined;

  constructor(kind: ProviderError['kind'], message: string, retryAfterSeconds?: number) {
    super(message);
    this.kind = kind;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
