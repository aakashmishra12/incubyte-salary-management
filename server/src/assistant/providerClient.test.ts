import { describe, expect, it } from 'vitest';
import { createOpenAiCompatibleClient, PROVIDER_TIMEOUT_MS } from './providerClient.ts';
import { afterEach, vi } from 'vitest';
import { ProviderError, type ModelRequest } from './types.ts';

const SECRET = 'sk-secret-key-123';

const request: ModelRequest = {
  maxTokens: 500,
  messages: [
    { role: 'system', content: 'Be brief.' },
    { role: 'user', content: 'Who is paid most?' },
  ],
  tools: [
    {
      name: 'get_overview',
      description: 'Company totals',
      parameters: { type: 'object', properties: {} },
    },
  ],
};

/** A fetch that records what it was asked and answers with a prepared response. */
function aFetch(respond: () => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return respond();
  };
  return { fetchFn: fetchFn as typeof fetch, calls };
}

/** Pass null for a provider with no key. (A default value would replace undefined.) */
function client(fetchFn: typeof fetch, apiKey: string | null = SECRET) {
  return createOpenAiCompatibleClient({
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.example.test/openai/v1',
    apiKey: apiKey ?? undefined,
    model: 'test-model',
    fetch: fetchFn,
  });
}

const answer = (content: string) =>
  Response.json({ choices: [{ message: { role: 'assistant', content } }] });

async function failureOf(promise: Promise<unknown>): Promise<ProviderError> {
  try {
    await promise;
  } catch (error) {
    return error as ProviderError;
  }
  throw new Error('Expected the call to fail');
}

describe('createOpenAiCompatibleClient: the request', () => {
  it('posts to the chat completions address with the key, model and settings', async () => {
    const { fetchFn, calls } = aFetch(() => answer('Hello'));

    await client(fetchFn).complete(request);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://api.example.test/openai/v1/chat/completions');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${SECRET}`);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      model: 'test-model',
      temperature: 0,
      max_tokens: 500,
      messages: [
        { role: 'system', content: 'Be brief.' },
        { role: 'user', content: 'Who is paid most?' },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_overview',
            description: 'Company totals',
            parameters: { type: 'object', properties: {} },
          },
        },
      ],
    });
  });

  it('sends no Authorization header when there is no key, as for a local Ollama', async () => {
    const { fetchFn, calls } = aFetch(() => answer('Hello'));

    await client(fetchFn, null).complete(request);

    expect(calls[0]!.init.headers).not.toHaveProperty('Authorization');
  });

  it('sends earlier tool calls and their results in the provider format', async () => {
    const { fetchFn, calls } = aFetch(() => answer('Done'));

    await client(fetchFn).complete({
      ...request,
      messages: [
        { role: 'user', content: 'Q' },
        {
          role: 'assistant',
          content: null,
          toolCalls: [{ id: 'call_1', name: 'get_overview', arguments: '{}' }],
        },
        { role: 'tool', toolCallId: 'call_1', content: '{"activeEmployees":9598}' },
      ],
    });

    expect(JSON.parse(String(calls[0]!.init.body)).messages).toEqual([
      { role: 'user', content: 'Q' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          { id: 'call_1', type: 'function', function: { name: 'get_overview', arguments: '{}' } },
        ],
      },
      { role: 'tool', tool_call_id: 'call_1', content: '{"activeEmployees":9598}' },
    ]);
  });

  it('gives up after its time limit', async () => {
    const { fetchFn } = aFetch(
      () => new Promise<Response>(() => {}), // never answers
    );
    const slow = createOpenAiCompatibleClient({
      id: 'groq',
      label: 'Groq',
      baseUrl: 'https://api.example.test/v1',
      apiKey: SECRET,
      model: 'm',
      fetch: fetchFn,
      timeoutMs: 20,
    });

    // The stub ignores the abort signal, so the client must enforce the limit itself.
    const error = await failureOf(slow.complete(request));

    expect(error).toBeInstanceOf(ProviderError);
    expect(error.kind).toBe('unavailable');
  });
});

describe('createOpenAiCompatibleClient: the reply', () => {
  it('returns the text of a plain answer', async () => {
    const { fetchFn } = aFetch(() => answer('Mei is paid most.'));

    expect(await client(fetchFn).complete(request)).toEqual({
      content: 'Mei is paid most.',
      toolCalls: [],
    });
  });

  it('returns the tools the model asked for', async () => {
    const { fetchFn } = aFetch(() =>
      Response.json({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_9',
                  type: 'function',
                  function: { name: 'get_breakdown', arguments: '{"groupBy":"level"}' },
                },
              ],
            },
          },
        ],
      }),
    );

    expect(await client(fetchFn).complete(request)).toEqual({
      content: null,
      toolCalls: [{ id: 'call_9', name: 'get_breakdown', arguments: '{"groupBy":"level"}' }],
    });
  });

  it('makes up an id when the provider leaves one out', async () => {
    const { fetchFn } = aFetch(() =>
      Response.json({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [{ function: { name: 'get_overview', arguments: '{}' } }],
            },
          },
        ],
      }),
    );

    const reply = await client(fetchFn).complete(request);

    expect(reply.toolCalls[0]!.id).toBe('call_0');
  });
});

describe('createOpenAiCompatibleClient: a reply that ran out of room', () => {
  it('marks it, so it is never presented as complete', async () => {
    const { fetchFn } = aFetch(() =>
      Response.json({
        choices: [
          { finish_reason: 'length', message: { role: 'assistant', content: 'Here is the list:' } },
        ],
      }),
    );

    expect(await client(fetchFn).complete(request)).toEqual({
      content: 'Here is the list:',
      toolCalls: [],
      truncated: true,
    });
  });

  it('does not mark a reply that finished normally', async () => {
    const { fetchFn } = aFetch(() =>
      Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'Done.' } }] }),
    );

    expect(await client(fetchFn).complete(request)).not.toHaveProperty('truncated');
  });
});

describe('createOpenAiCompatibleClient: provider-specific settings', () => {
  it('adds them to the request, but never lets them replace the model or the messages', async () => {
    const { fetchFn, calls } = aFetch(() => answer('ok'));
    const tuned = createOpenAiCompatibleClient({
      id: 'gemini',
      label: 'Gemini',
      baseUrl: 'https://api.example.test/v1',
      apiKey: SECRET,
      model: 'test-model',
      extraBody: { reasoning_effort: 'low', model: 'someone-else', messages: [] },
      fetch: fetchFn,
    });

    await tuned.complete(request);

    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.reasoning_effort).toBe('low');
    expect(body.model).toBe('test-model');
    expect(body.messages).toHaveLength(2);
  });
});

describe('createOpenAiCompatibleClient: when it goes wrong', () => {
  it('reports a rate limit with the wait the provider asked for', async () => {
    const { fetchFn } = aFetch(
      () =>
        new Response('{"error":"slow down"}', { status: 429, headers: { 'retry-after': '37' } }),
    );

    const error = await failureOf(client(fetchFn).complete(request));

    expect(error).toMatchObject({ kind: 'rate_limited', retryAfterSeconds: 37 });
  });

  it('reports a rate limit without a wait when the provider gives none', async () => {
    const { fetchFn } = aFetch(() => new Response('', { status: 429 }));

    const error = await failureOf(client(fetchFn).complete(request));

    expect(error.kind).toBe('rate_limited');
    expect(error.retryAfterSeconds).toBeUndefined();
  });

  it.each([401, 403, 404])(
    'treats status %i as a setup problem, not a passing one',
    async (status) => {
      const { fetchFn } = aFetch(() => new Response('{"error":"no"}', { status }));

      const error = await failureOf(client(fetchFn).complete(request));

      expect(error.kind).toBe('misconfigured');
    },
  );

  it.each([402, 405, 409, 413, 415, 451])(
    'treats status %i as this one request being refused, not as a broken provider',
    async (status) => {
      const { fetchFn } = aFetch(() => new Response('{"error":"no"}', { status }));

      const error = await failureOf(client(fetchFn).complete(request));

      expect(error.kind).toBe('rejected');
    },
  );

  it.each([400, 422])('treats status %i as this one request being refused', async (status) => {
    const { fetchFn } = aFetch(() => new Response('{"error":"bad request"}', { status }));

    const error = await failureOf(client(fetchFn).complete(request));

    expect(error.kind).toBe('rejected');
  });

  it.each([408, 500, 502, 503])(
    'treats status %i as the provider being unavailable',
    async (status) => {
      const { fetchFn } = aFetch(() => new Response('oops', { status }));

      const error = await failureOf(client(fetchFn).complete(request));

      expect(error.kind).toBe('unavailable');
    },
  );

  it('treats a network failure as the provider being unavailable', async () => {
    const { fetchFn } = aFetch(() => Promise.reject(new TypeError('fetch failed')));

    const error = await failureOf(client(fetchFn).complete(request));

    expect(error.kind).toBe('unavailable');
  });

  it('treats an empty reply as unavailable', async () => {
    const { fetchFn } = aFetch(() => Response.json({ choices: [{ message: { content: null } }] }));

    const error = await failureOf(client(fetchFn).complete(request));

    expect(error.kind).toBe('unavailable');
  });

  it('treats a reply that is not JSON as unavailable', async () => {
    const { fetchFn } = aFetch(() => new Response('<html>gateway</html>', { status: 200 }));

    const error = await failureOf(client(fetchFn).complete(request));

    expect(error.kind).toBe('unavailable');
  });

  it('never puts the key or the provider text into an error message', async () => {
    const leaks = [
      aFetch(() => new Response(`bad key ${SECRET}`, { status: 401 })),
      aFetch(() => Promise.reject(new Error(`request to ?key=${SECRET} failed`))),
      aFetch(() => new Response(`overloaded ${SECRET}`, { status: 503 })),
    ];

    for (const { fetchFn } of leaks) {
      const error = await failureOf(client(fetchFn).complete(request));

      expect(error.message).not.toContain(SECRET);
      expect(JSON.stringify(error)).not.toContain(SECRET);
    }
  });
});

describe('createOpenAiCompatibleClient: Gemini thought signatures', () => {
  const geminiReply = () =>
    Response.json({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 'call_g',
                type: 'function',
                function: { name: 'get_overview', arguments: '{}' },
                extra_content: { google: { thought_signature: 'SIG-123' } },
              },
            ],
          },
        },
      ],
    });

  const history = (extra?: { providerId: 'gemini' | 'groq'; value: unknown }): ModelRequest => ({
    ...request,
    messages: [
      { role: 'user', content: 'Q' },
      {
        role: 'assistant',
        content: null,
        toolCalls: [
          { id: 'call_g', name: 'get_overview', arguments: '{}', ...(extra ? { extra } : {}) },
        ],
      },
      { role: 'tool', toolCallId: 'call_g', content: '{}' },
    ],
  });

  function aProviderNamed(id: 'gemini' | 'groq', fetchFn: typeof fetch) {
    return createOpenAiCompatibleClient({
      id,
      label: id,
      baseUrl: 'https://api.example.test/v1',
      apiKey: SECRET,
      model: 'm',
      fetch: fetchFn,
    });
  }

  const sentToolCall = (calls: { init: RequestInit }[]) =>
    JSON.parse(String(calls[0]!.init.body)).messages[1].tool_calls[0];

  it('keeps the signature Gemini attaches to a tool call', async () => {
    const { fetchFn } = aFetch(() => geminiReply());

    const reply = await aProviderNamed('gemini', fetchFn).complete(request);

    expect(reply.toolCalls[0]!.extra).toEqual({
      providerId: 'gemini',
      value: { google: { thought_signature: 'SIG-123' } },
    });
  });

  it('sends Gemini its own signature back, because it refuses tool results without one', async () => {
    const { fetchFn, calls } = aFetch(() => answer('ok'));

    await aProviderNamed('gemini', fetchFn).complete(
      history({ providerId: 'gemini', value: { google: { thought_signature: 'SIG-123' } } }),
    );

    expect(sentToolCall(calls).extra_content).toEqual({ google: { thought_signature: 'SIG-123' } });
  });

  it('sends a placeholder signature for a tool call that another provider made', async () => {
    const { fetchFn, calls } = aFetch(() => answer('ok'));

    await aProviderNamed('gemini', fetchFn).complete(history({ providerId: 'groq', value: {} }));

    expect(sentToolCall(calls).extra_content).toEqual({
      google: { thought_signature: 'skip_thought_signature_validator' },
    });
  });

  it('sends a placeholder signature for a tool call that has no provider data at all', async () => {
    const { fetchFn, calls } = aFetch(() => answer('ok'));

    await aProviderNamed('gemini', fetchFn).complete(history());

    expect(sentToolCall(calls).extra_content).toEqual({
      google: { thought_signature: 'skip_thought_signature_validator' },
    });
  });

  it('never sends Gemini-only data to any other provider', async () => {
    const { fetchFn, calls } = aFetch(() => answer('ok'));

    await aProviderNamed('groq', fetchFn).complete(
      history({ providerId: 'gemini', value: { google: { thought_signature: 'SIG-123' } } }),
    );

    expect(sentToolCall(calls)).not.toHaveProperty('extra_content');
  });
});

describe('createOpenAiCompatibleClient: time limits and clean-up', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits up to 30 seconds by default, as the spec promises, and not a moment longer', async () => {
    vi.useFakeTimers();
    expect(PROVIDER_TIMEOUT_MS).toBe(30_000);
    const { fetchFn } = aFetch(() => new Promise<Response>(() => {}));
    const slow = createOpenAiCompatibleClient({
      id: 'groq',
      label: 'Groq',
      baseUrl: 'https://api.example.test/v1',
      apiKey: SECRET,
      model: 'm',
      fetch: fetchFn,
    });
    let outcome: unknown = 'pending';
    slow.complete(request).catch((error) => (outcome = error));

    await vi.advanceTimersByTimeAsync(29_999);
    expect(outcome).toBe('pending');
    await vi.advanceTimersByTimeAsync(2);

    expect(outcome).toMatchObject({ kind: 'unavailable' });
  });

  it('cancels the request itself when the time is up, so it does not keep running', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetchFn = ((_url: unknown, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    }) as typeof fetch;
    const slow = createOpenAiCompatibleClient({
      id: 'groq',
      label: 'Groq',
      baseUrl: 'https://api.example.test/v1',
      model: 'm',
      fetch: fetchFn,
      timeoutMs: 100,
    });
    slow.complete(request).catch(() => {});

    await vi.advanceTimersByTimeAsync(101);

    expect(signal?.aborted).toBe(true);
  });

  it('leaves no timer running after a call that succeeds', async () => {
    vi.useFakeTimers();
    const { fetchFn } = aFetch(() => answer('Hello'));

    await client(fetchFn).complete(request);

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('createOpenAiCompatibleClient: replies in unusual shapes', () => {
  it('accepts tool arguments sent as an object, as some local servers do, and passes them on as text', async () => {
    const { fetchFn } = aFetch(() =>
      Response.json({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                { id: 'c1', function: { name: 'get_breakdown', arguments: { groupBy: 'level' } } },
              ],
            },
          },
        ],
      }),
    );

    const reply = await client(fetchFn).complete(request);

    expect(reply.toolCalls[0]!.arguments).toBe('{"groupBy":"level"}');
  });

  it('treats an answer of only spaces as empty', async () => {
    const { fetchFn } = aFetch(() => answer('   \n  '));

    const error = await failureOf(client(fetchFn).complete(request));

    expect(error.kind).toBe('unavailable');
  });

  it('trims the spaces around a real answer', async () => {
    const { fetchFn } = aFetch(() => answer('  Hello  \n'));

    expect((await client(fetchFn).complete(request)).content).toBe('Hello');
  });

  it('skips a tool call that has no name instead of failing the whole reply', async () => {
    const { fetchFn } = aFetch(() =>
      Response.json({
        choices: [
          { message: { content: 'Hi', tool_calls: [{ id: 'c1', function: { arguments: '{}' } }] } },
        ],
      }),
    );

    expect(await client(fetchFn).complete(request)).toEqual({ content: 'Hi', toolCalls: [] });
  });
});
