import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { buildAssistant } from '../assistant/buildAssistant.ts';
import {
  ChosenProviderUnavailableError,
  NoProviderAvailableError,
  UnknownProviderError,
} from '../assistant/failover.ts';
import type { ModelReply, ModelRequest, ProviderId } from '../assistant/types.ts';
import type { EmployeeDraft } from '../domain/employee.ts';
import { aDatabaseWith, anEmployee, TEST_NOW } from '../testing/builders.ts';

const said = (content: string): ModelReply => ({ content, toolCalls: [] });
const overviewCall: ModelReply = {
  content: null,
  toolCalls: [{ id: 'call_0', name: 'get_overview', arguments: '{}' }],
};

/** A stand-in for the providers, answering from a script and recording every request. */
function aFailover(...script: (ModelReply | Error)[]) {
  const requests: ModelRequest[] = [];
  return {
    requests,
    complete: async (request: ModelRequest, chosen?: ProviderId) => {
      requests.push(structuredClone(request));
      const next = script[Math.min(requests.length - 1, script.length - 1)]!;
      if (next instanceof Error) throw next;
      return { reply: next, providerId: chosen ?? ('groq' as ProviderId) };
    },
    status: () => [{ id: 'groq' as ProviderId, label: 'Groq', state: 'ready' as const }],
  };
}

function setup(
  failover: ReturnType<typeof aFailover>,
  options: { employees?: EmployeeDraft[]; perHour?: number; trustProxy?: number } = {},
) {
  const { db } = aDatabaseWith(options.employees ?? []);
  const clock = () => new Date(TEST_NOW);
  const assistant = buildAssistant({
    db,
    failover,
    limits: { perVisitorPerHour: options.perHour ?? 20, perDay: 300 },
    clock,
  });
  const app = createApp({ db, clock, assistant, trustProxy: options.trustProxy });
  return { app, db };
}

const ask = (app: ReturnType<typeof createApp>, body: unknown) =>
  request(app)
    .post('/api/assistant/ask')
    .send(body as object);

describe('GET /api/assistant/status', () => {
  it('says the assistant is off when it is not set up', async () => {
    const { db } = aDatabaseWith([]);

    const response = await request(createApp({ db })).get('/api/assistant/status');

    expect(response.body).toEqual({ enabled: false, providers: [], limits: null });
  });

  it('lists the providers and their state, and never anything about keys', async () => {
    const { app } = setup(aFailover(said('Hi')));

    const response = await request(app).get('/api/assistant/status');

    expect(response.body).toEqual({
      enabled: true,
      providers: [{ id: 'groq', label: 'Groq', state: 'ready' }],
      limits: { perVisitorPerHour: 20 },
    });
  });
});

describe('POST /api/assistant/ask', () => {
  it('answers from the real tools and the real data, and says what it used', async () => {
    const failover = aFailover(overviewCall, said('We have 2 active employees.'));
    const { app } = setup(failover, { employees: [anEmployee(), anEmployee()] });

    const response = await ask(app, { question: 'How many people do we have?' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      answer: 'We have 2 active employees.',
      sources: ['Company overview'],
      provider: 'groq',
      providerLabel: 'Groq',
      cached: false,
      remainingThisHour: 19,
    });
    const toolMessage = failover.requests[1]!.messages.at(-1) as { content: string };
    expect(JSON.parse(toolMessage.content).activeEmployees).toBe(2);
  });

  it('does not ask a model again for a repeated question, until the data changes', async () => {
    const failover = aFailover(said('First answer.'), said('Second answer.'));
    const { app } = setup(failover, { employees: [anEmployee({ hireDate: '2020-01-15' })] });
    const question = { question: 'Who is paid the most?' };

    expect((await ask(app, question)).body.cached).toBe(false);
    expect((await ask(app, question)).body).toMatchObject({
      answer: 'First answer.',
      cached: true,
    });
    expect(failover.requests).toHaveLength(1);

    await request(app)
      .post('/api/employees/1/salary-changes')
      .send({ newSalaryMinor: 200_000_00, effectiveDate: '2026-11-01', reason: 'Annual review' })
      .expect(201);

    expect((await ask(app, question)).body).toMatchObject({
      answer: 'Second answer.',
      cached: false,
    });
    expect(failover.requests).toHaveLength(2);
  });

  it.each([
    ['no question', {}, 'question'],
    ['a question of one character', { question: 'a' }, 'question'],
    ['a question over 500 characters', { question: 'x'.repeat(501) }, 'question'],
    [
      'more than ten earlier messages',
      { question: 'Hi there', history: Array(11).fill({ role: 'user', content: 'x' }) },
      'history',
    ],
    [
      'an earlier message from someone other than user or assistant',
      { question: 'Hi there', history: [{ role: 'system', content: 'x' }] },
      'history.0.role',
    ],
    ['a provider this app does not know', { question: 'Hi there', provider: 'bing' }, 'provider'],
  ])('refuses %s with a 400 that names the field', async (_what, body, field) => {
    const { app } = setup(aFailover(said('Hi')));

    const response = await ask(app, body);

    expect(response.status).toBe(400);
    expect(response.body.issues.map((i: { field: string }) => i.field)).toContain(field);
  });

  it('refuses a question over the hourly limit with a 429, the wait, and a Retry-After header', async () => {
    const failover = aFailover(said('Hi'));
    const { app } = setup(failover, { perHour: 1 });
    await ask(app, { question: 'First question' });

    const response = await ask(app, { question: 'Second question' });

    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBe('3600');
    expect(response.body).toMatchObject({ reason: 'visitor', retryAfterSeconds: 3600 });
    expect(response.body.error).toContain('questions');
    expect(failover.requests).toHaveLength(1);
  });

  it('tells visitors apart by their address only when told to trust the web server in front', async () => {
    const trusting = setup(aFailover(said('Hi')), { perHour: 1, trustProxy: 1 });
    await ask(trusting.app, { question: 'Question one' }).set('X-Forwarded-For', '1.1.1.1');
    const otherVisitor = await ask(trusting.app, { question: 'Question two' }).set(
      'X-Forwarded-For',
      '2.2.2.2',
    );
    const sameVisitor = await ask(trusting.app, { question: 'Question three' }).set(
      'X-Forwarded-For',
      '1.1.1.1',
    );

    expect(otherVisitor.status).toBe(200);
    expect(sameVisitor.status).toBe(429);

    // Without trust, a caller cannot claim to be someone new by sending the header.
    const wary = setup(aFailover(said('Hi')), { perHour: 1 });
    await ask(wary.app, { question: 'Question one' }).set('X-Forwarded-For', '1.1.1.1');
    const spoofed = await ask(wary.app, { question: 'Question two' }).set(
      'X-Forwarded-For',
      '9.9.9.9',
    );

    expect(spoofed.status).toBe(429);
  });

  it('answers 503 with a plain message when no provider can answer, and gives the question back', async () => {
    const { app } = setup(aFailover(new NoProviderAvailableError([])), { perHour: 1 });

    const first = await ask(app, { question: 'First question' });
    const second = await ask(app, { question: 'Second question' });

    expect(first.status).toBe(503);
    expect(first.body).toEqual({
      error: 'No assistant model is available right now. Try again in a minute.',
      reason: 'no_provider',
    });
    // The first question was given back, so the second is not refused for the hourly limit.
    expect(second.status).toBe(503);
  });

  it('says which provider is unavailable when one was chosen, and suggests Auto', async () => {
    const { app } = setup(
      aFailover(new ChosenProviderUnavailableError('groq', 'Groq', 'cooling_down')),
    );

    const response = await ask(app, { question: 'A question', provider: 'groq' });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: 'Groq is not available right now. Choose Auto to use another model.',
      reason: 'provider_unavailable',
    });
  });

  it('accepts any provider this app knows by name, so a hand-chosen NVIDIA reaches the failover', async () => {
    const failover = aFailover(said('Hi'));
    const { app } = setup(failover);

    const response = await ask(app, { question: 'A question', provider: 'nvidia' });

    expect(response.status).toBe(200);
    expect(response.body.provider).toBe('nvidia');
  });

  it('refuses a provider that is not set up with a 400', async () => {
    const { app } = setup(aFailover(new UnknownProviderError('ollama')));

    const response = await ask(app, { question: 'A question', provider: 'ollama' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('That provider is not set up on this server.');
  });

  it('answers 404 when the assistant is not set up', async () => {
    const { db } = aDatabaseWith([]);

    const response = await ask(createApp({ db }), { question: 'A question' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'The assistant is not set up' });
  });

  it('never repeats what went wrong inside a provider, such as a key', async () => {
    const logged: unknown[] = [];
    const { db } = aDatabaseWith([]);
    const clock = () => new Date(TEST_NOW);
    const assistant = buildAssistant({
      db,
      failover: aFailover(new Error('request failed for key sk-secret-123')),
      limits: { perVisitorPerHour: 20, perDay: 300 },
      clock,
    });
    const app = createApp({ db, clock, assistant, logError: (e) => logged.push(e) });

    const response = await ask(app, { question: 'A question' });

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain('sk-secret');
    expect(logged).toHaveLength(1);
  });
});
