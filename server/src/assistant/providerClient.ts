import {
  ProviderError,
  type ChatMessage,
  type ModelClient,
  type ModelReply,
  type ModelRequest,
  type ProviderId,
  type ToolCall,
} from './types.ts';

export interface ProviderClientOptions {
  id: ProviderId;
  label: string;
  /** For example https://api.groq.com/openai/v1 . */
  baseUrl: string;
  /** Not needed for a local Ollama. */
  apiKey?: string | undefined;
  model: string;
  /** Replaced by a fake in tests. */
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Talks to any provider that offers the OpenAI-style "chat completions" API with tools.
 * Groq, OpenRouter and Ollama all do, so one client serves all three.
 */
export function createOpenAiCompatibleClient({
  id,
  label,
  baseUrl,
  apiKey,
  model,
  fetch: fetchFn = fetch,
  timeoutMs = 30_000,
}: ProviderClientOptions): ModelClient {
  async function call(request: ModelRequest, signal: AbortSignal): Promise<ModelReply> {
    const response = await fetchFn(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        // Zero: the same question should give the same tool calls as far as possible.
        temperature: 0,
        max_tokens: request.maxTokens,
        messages: request.messages.map(toProviderMessage),
        tools: request.tools.map((tool) => ({ type: 'function', function: tool })),
      }),
    });

    // The messages below are fixed text. What the provider sent back is never copied into
    // them, because it could contain the key or something that should not be shown.
    if (response.status === 429) {
      throw new ProviderError('rate_limited', `${label} is rate limited`, retryAfterOf(response));
    }
    if (response.status === 408 || response.status >= 500) {
      throw new ProviderError('unavailable', `${label} answered with status ${response.status}`);
    }
    if (!response.ok) {
      throw new ProviderError(
        'misconfigured',
        `${label} refused the request with status ${response.status}`,
      );
    }

    return parseReply(await response.json(), label);
  }

  return {
    id,
    label,
    async complete(request) {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      // A stuck provider must not hold a question forever, even if it ignores the abort signal.
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new ProviderError('unavailable', `${label} did not answer in time`));
        }, timeoutMs);
      });

      try {
        return await Promise.race([call(request, controller.signal), timeout]);
      } catch (error) {
        if (error instanceof ProviderError) throw error;
        // A network failure, or a reply that was not JSON.
        throw new ProviderError('unavailable', `${label} could not be reached`);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/** Converts a message from this app's shape to the provider's. */
function toProviderMessage(message: ChatMessage): Record<string, unknown> {
  if (message.role === 'tool') {
    return { role: 'tool', tool_call_id: message.toolCallId, content: message.content };
  }
  if (message.role === 'assistant' && message.toolCalls?.length) {
    return {
      role: 'assistant',
      content: message.content,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: 'function',
        function: { name: call.name, arguments: call.arguments },
      })),
    };
  }
  return { role: message.role, content: message.content };
}

/** The seconds the provider asked us to wait, when it said so in plain seconds. */
function retryAfterOf(response: Response): number | undefined {
  const seconds = Number(response.headers.get('retry-after'));
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined;
}

/** What a provider may send for one tool call. Every field is checked before use. */
interface RawToolCall {
  id?: unknown;
  function?: { name?: unknown; arguments?: unknown };
}

/** Reads the first choice of a reply. Anything unexpected counts as the provider being unavailable. */
function parseReply(body: unknown, label: string): ModelReply {
  const message = (body as { choices?: { message?: Record<string, unknown> }[] })?.choices?.[0]
    ?.message;

  const content =
    typeof message?.content === 'string' && message.content.trim() !== ''
      ? message.content.trim()
      : null;

  const rawCalls: RawToolCall[] = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
  const toolCalls: ToolCall[] = rawCalls.flatMap((raw, index) => {
    const name = raw?.function?.name;
    if (typeof name !== 'string') return [];
    const args = raw.function?.arguments;
    return [
      {
        id: typeof raw.id === 'string' ? raw.id : `call_${index}`,
        name,
        arguments: typeof args === 'string' ? args : JSON.stringify(args ?? {}),
      },
    ];
  });

  if (content === null && toolCalls.length === 0) {
    throw new ProviderError('unavailable', `${label} sent an empty reply`);
  }
  return { content, toolCalls };
}
