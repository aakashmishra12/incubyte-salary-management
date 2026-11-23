import { describe, expect, it } from 'vitest';
import {
  ChosenProviderUnavailableError,
  createFailover,
  NoProviderAvailableError,
  UnknownProviderError,
} from './failover.ts';
import {
  ProviderError,
  type ModelClient,
  type ModelReply,
  type ModelRequest,
  type ProviderId,
} from './types.ts';

const request: ModelRequest = { messages: [], tools: [], maxTokens: 100 };

/** A clock the test moves by hand. */
function aClock(start = '2026-11-24T10:00:00Z') {
  let now = new Date(start).getTime();
  return { now: () => new Date(now), advance: (seconds: number) => (now += seconds * 1000) };
}

/** A fake provider. Each call takes the next prepared outcome, and the last one repeats. */
function aProvider(id: ProviderId, ...outcomes: (ModelReply | ProviderError | Error)[]) {
  let calls = 0;
  const client: ModelClient = {
    id,
    label: id.toUpperCase(),
    async complete() {
      const outcome = outcomes[Math.min(calls, outcomes.length - 1)]!;
      calls += 1;
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
  };
  return { client, calls: () => calls };
}

const said = (content: string): ModelReply => ({ content, toolCalls: [] });
const limited = (retryAfterSeconds?: number) =>
  new ProviderError('rate_limited', 'limited', retryAfterSeconds);
const down = () => new ProviderError('unavailable', 'down');
const badKey = () => new ProviderError('misconfigured', 'bad key');

function setup(providers: { client: ModelClient; dailyLimit?: number }[], clock = aClock()) {
  const logged: unknown[] = [];
  const failover = createFailover({ providers, clock: clock.now, logError: (e) => logged.push(e) });
  return { failover, clock, logged };
}

describe('createFailover in Auto mode', () => {
  it('uses the first provider while it works', async () => {
    const groq = aProvider('groq', said('from groq'));
    const router = aProvider('openrouter', said('from openrouter'));
    const { failover } = setup([{ client: groq.client }, { client: router.client }]);

    expect(await failover.complete(request)).toEqual({
      reply: said('from groq'),
      providerId: 'groq',
    });
    expect(router.calls()).toBe(0);
  });

  it('moves to the next provider within the same question when one is rate limited', async () => {
    const groq = aProvider('groq', limited(30));
    const router = aProvider('openrouter', said('from openrouter'));
    const { failover } = setup([{ client: groq.client }, { client: router.client }]);

    expect(await failover.complete(request)).toEqual({
      reply: said('from openrouter'),
      providerId: 'openrouter',
    });
  });

  it('leaves a rate limited provider alone until its wait is over', async () => {
    const groq = aProvider('groq', limited(30), said('groq again'));
    const router = aProvider('openrouter', said('from openrouter'));
    const { failover, clock } = setup([{ client: groq.client }, { client: router.client }]);
    await failover.complete(request);

    clock.advance(29);
    await failover.complete(request);
    expect(groq.calls()).toBe(1);

    clock.advance(2);
    expect((await failover.complete(request)).providerId).toBe('groq');
    expect(groq.calls()).toBe(2);
  });

  it('waits 60 seconds when a rate limit gives no time, and 30 when a provider is down', async () => {
    const groq = aProvider('groq', limited(), said('ok'));
    const router = aProvider('openrouter', down(), said('ok'));
    const { failover, clock } = setup([{ client: groq.client }, { client: router.client }]);
    await failover.complete(request).catch(() => {});

    expect(failover.status().map((s) => [s.id, s.state])).toEqual([
      ['groq', 'cooling_down'],
      ['openrouter', 'cooling_down'],
    ]);
    clock.advance(31);
    expect(failover.status().map((s) => s.state)).toEqual(['cooling_down', 'ready']);
    clock.advance(30);
    expect(failover.status().map((s) => s.state)).toEqual(['ready', 'ready']);
  });

  it('never waits longer than an hour, even if a provider asks for more', async () => {
    const groq = aProvider('groq', limited(86_400));
    const { failover, clock } = setup([{ client: groq.client }]);
    await failover.complete(request).catch(() => {});

    clock.advance(3601);

    expect(failover.status()[0]!.state).toBe('ready');
  });

  it('stops using a provider for an hour when its key or model is wrong, and logs it', async () => {
    const groq = aProvider('groq', badKey());
    const router = aProvider('openrouter', said('ok'));
    const { failover, clock, logged } = setup([{ client: groq.client }, { client: router.client }]);

    await failover.complete(request);

    expect(failover.status()[0]).toMatchObject({ id: 'groq', state: 'misconfigured' });
    expect(logged).toHaveLength(1);
    clock.advance(3601);
    expect(failover.status()[0]!.state).toBe('ready');
  });

  it('treats an unexpected crash in a provider like the provider being down, and logs it', async () => {
    const groq = aProvider('groq', new TypeError('bug'));
    const router = aProvider('openrouter', said('ok'));
    const { failover, logged } = setup([{ client: groq.client }, { client: router.client }]);

    expect((await failover.complete(request)).providerId).toBe('openrouter');
    expect(logged).toHaveLength(1);
  });

  it('says so when every provider is unavailable, and lists what happened', async () => {
    const groq = aProvider('groq', limited(30));
    const router = aProvider('openrouter', down());
    const { failover } = setup([{ client: groq.client }, { client: router.client }]);

    const error = await failover.complete(request).catch((e) => e);

    expect(error).toBeInstanceOf(NoProviderAvailableError);
    expect(error.attempts).toEqual([
      { providerId: 'groq', outcome: 'rate_limited' },
      { providerId: 'openrouter', outcome: 'unavailable' },
    ]);
  });

  it('says so when no provider is set up at all', async () => {
    const { failover } = setup([]);

    await expect(failover.complete(request)).rejects.toBeInstanceOf(NoProviderAvailableError);
    expect(failover.status()).toEqual([]);
  });
});

describe('createFailover daily budgets', () => {
  it('counts every attempt, failed ones included, and then skips the provider for the day', async () => {
    const groq = aProvider('groq', down(), said('ok'), said('ok'));
    const router = aProvider('openrouter', said('from openrouter'));
    const { failover, clock } = setup([
      { client: groq.client, dailyLimit: 2 },
      { client: router.client },
    ]);

    await failover.complete(request); // groq fails (attempt 1), openrouter answers
    clock.advance(31);
    await failover.complete(request); // groq answers (attempt 2)

    expect(failover.status()[0]!.state).toBe('daily_limit_reached');
    expect((await failover.complete(request)).providerId).toBe('openrouter');
    expect(groq.calls()).toBe(2);
  });

  it('gives the budget back at midnight UTC', async () => {
    const clock = aClock('2026-11-24T23:59:00Z');
    const groq = aProvider('groq', said('ok'));
    const { failover } = setup([{ client: groq.client, dailyLimit: 1 }], clock);
    await failover.complete(request);
    expect(failover.status()[0]!.state).toBe('daily_limit_reached');

    clock.advance(120);

    expect(failover.status()[0]!.state).toBe('ready');
    expect((await failover.complete(request)).providerId).toBe('groq');
  });

  it('says when a provider will be available again', async () => {
    const clock = aClock('2026-11-24T23:00:00Z');
    const groq = aProvider('groq', said('ok'));
    const { failover } = setup([{ client: groq.client, dailyLimit: 1 }], clock);
    await failover.complete(request);

    expect(failover.status()[0]!.availableAgainAt).toBe('2026-11-25T00:00:00.000Z');
  });
});

describe('createFailover with a chosen provider', () => {
  it('uses only the provider that was chosen', async () => {
    const groq = aProvider('groq', said('from groq'));
    const router = aProvider('openrouter', said('from openrouter'));
    const { failover } = setup([{ client: groq.client }, { client: router.client }]);

    expect((await failover.complete(request, 'openrouter')).providerId).toBe('openrouter');
    expect(groq.calls()).toBe(0);
  });

  it('does not switch to another provider when the chosen one fails', async () => {
    const groq = aProvider('groq', limited(30));
    const router = aProvider('openrouter', said('from openrouter'));
    const { failover } = setup([{ client: groq.client }, { client: router.client }]);

    const error = await failover.complete(request, 'groq').catch((e) => e);

    expect(error).toBeInstanceOf(ChosenProviderUnavailableError);
    expect(error.providerLabel).toBe('GROQ');
    expect(router.calls()).toBe(0);
  });

  it('refuses a chosen provider that is cooling down without calling it', async () => {
    const groq = aProvider('groq', limited(30));
    const { failover } = setup([{ client: groq.client }]);
    await failover.complete(request, 'groq').catch(() => {});

    await expect(failover.complete(request, 'groq')).rejects.toBeInstanceOf(
      ChosenProviderUnavailableError,
    );
    expect(groq.calls()).toBe(1);
  });

  it('refuses a provider that is not set up', async () => {
    const groq = aProvider('groq', said('ok'));
    const { failover } = setup([{ client: groq.client }]);

    await expect(failover.complete(request, 'ollama')).rejects.toBeInstanceOf(UnknownProviderError);
  });
});

describe('createFailover status', () => {
  it('shows only the id, label, state and time, never anything about keys', () => {
    const groq = aProvider('groq', said('ok'));
    const { failover } = setup([{ client: groq.client }]);

    expect(failover.status()).toEqual([{ id: 'groq', label: 'GROQ', state: 'ready' }]);
  });
});
