import {
  ProviderError,
  type ModelClient,
  type ModelReply,
  type ModelRequest,
  type ProviderId,
} from './types.ts';

// How long a provider is left alone after each kind of failure.
const RATE_LIMIT_DEFAULT_SECONDS = 60;
const UNAVAILABLE_SECONDS = 30;
const MISCONFIGURED_SECONDS = 3600;
const REJECTED_SECONDS = 300;
/** A provider may ask for a long wait. The status would show it as down all day, so cap it. */
const MAX_WAIT_SECONDS = 3600;

export type ProviderState = 'ready' | 'cooling_down' | 'daily_limit_reached' | 'misconfigured';

export interface ProviderStatus {
  id: ProviderId;
  label: string;
  state: ProviderState;
  /** When the provider can be used again. Present only when it cannot be used now. */
  availableAgainAt?: string;
}

export interface ProviderEntry {
  client: ModelClient;
  /** Most model calls per UTC day. Every attempt counts, failed ones too. */
  dailyLimit?: number | undefined;
}

export interface FailoverOptions {
  providers: ProviderEntry[];
  clock: () => Date;
  /** Where unexpected problems are written for an engineer to read. */
  logError: (error: unknown) => void;
}

/** Every provider that was tried (or skipped) failed. */
export class NoProviderAvailableError extends Error {
  readonly attempts: { providerId: ProviderId; outcome: string }[];

  constructor(attempts: NoProviderAvailableError['attempts']) {
    super('No assistant model is available right now');
    this.attempts = attempts;
  }
}

/** The HR Manager chose a provider, and it cannot answer. Nothing else was tried in its place. */
export class ChosenProviderUnavailableError extends Error {
  readonly providerId: ProviderId;
  readonly providerLabel: string;
  readonly state: ProviderState;

  constructor(providerId: ProviderId, providerLabel: string, state: ProviderState) {
    super(`${providerLabel} is not available right now`);
    this.providerId = providerId;
    this.providerLabel = providerLabel;
    this.state = state;
  }
}

/** The chosen provider is not set up on this server. */
export class UnknownProviderError extends Error {
  constructor(providerId: string) {
    super(`The provider ${providerId} is not set up`);
  }
}

/**
 * Sits in front of the providers. In Auto mode it tries them in order and moves on when one
 * is rate limited, down or refusing. It remembers who failed and leaves them alone for a while,
 * and it keeps a daily budget per provider so a free allowance is never knocked over by retries.
 * When a provider is chosen by hand, only that provider is used.
 */
export function createFailover({ providers, clock, logError }: FailoverOptions) {
  interface Tracking {
    entry: ProviderEntry;
    blockedUntil: number;
    blockedState: 'cooling_down' | 'misconfigured';
    day: string;
    attemptsToday: number;
  }

  const tracked: Tracking[] = providers.map((entry) => ({
    entry,
    blockedUntil: 0,
    blockedState: 'cooling_down',
    day: '',
    attemptsToday: 0,
  }));

  const today = () => clock().toISOString().slice(0, 10);

  function stateOf(item: Tracking): { state: ProviderState; availableAgainAt?: string } {
    const now = clock().getTime();
    if (item.blockedUntil > now) {
      return {
        state: item.blockedState,
        availableAgainAt: new Date(item.blockedUntil).toISOString(),
      };
    }
    const { dailyLimit } = item.entry;
    const count = item.day === today() ? item.attemptsToday : 0;
    if (dailyLimit !== undefined && count >= dailyLimit) {
      const midnight = new Date(`${today()}T00:00:00Z`).getTime() + 24 * 3600 * 1000;
      return { state: 'daily_limit_reached', availableAgainAt: new Date(midnight).toISOString() };
    }
    return { state: 'ready' };
  }

  /** Calls one provider, counts the attempt, and records how it went. */
  async function attempt(
    item: Tracking,
    request: ModelRequest,
  ): Promise<{ reply: ModelReply } | { failure: ProviderError['kind'] }> {
    if (item.day !== today()) {
      item.day = today();
      item.attemptsToday = 0;
    }
    item.attemptsToday += 1;

    try {
      return { reply: await item.entry.client.complete(request) };
    } catch (error) {
      const failure = error instanceof ProviderError ? error.kind : 'unavailable';
      let seconds = UNAVAILABLE_SECONDS;
      if (failure === 'rate_limited') {
        const asked = error instanceof ProviderError ? error.retryAfterSeconds : undefined;
        seconds = Math.min(asked ?? RATE_LIMIT_DEFAULT_SECONDS, MAX_WAIT_SECONDS);
      }
      if (failure === 'misconfigured') seconds = MISCONFIGURED_SECONDS;
      if (failure === 'rejected') seconds = REJECTED_SECONDS;

      item.blockedUntil = clock().getTime() + seconds * 1000;
      item.blockedState = failure === 'misconfigured' ? 'misconfigured' : 'cooling_down';

      // A wrong key or model, a refused request, or a bug, needs a person. A rate limit or an outage does not.
      if (
        failure === 'misconfigured' ||
        failure === 'rejected' ||
        !(error instanceof ProviderError)
      ) {
        logError(error);
      }
      return { failure };
    }
  }

  return {
    status(): ProviderStatus[] {
      return tracked.map((item) => ({
        id: item.entry.client.id,
        label: item.entry.client.label,
        ...stateOf(item),
      }));
    },

    async complete(
      request: ModelRequest,
      chosen?: ProviderId,
    ): Promise<{ reply: ModelReply; providerId: ProviderId }> {
      if (chosen) {
        const item = tracked.find((t) => t.entry.client.id === chosen);
        if (!item) throw new UnknownProviderError(chosen);

        const { state } = stateOf(item);
        if (state !== 'ready') {
          throw new ChosenProviderUnavailableError(chosen, item.entry.client.label, state);
        }
        const result = await attempt(item, request);
        if ('reply' in result) return { reply: result.reply, providerId: chosen };
        throw new ChosenProviderUnavailableError(
          chosen,
          item.entry.client.label,
          stateOf(item).state,
        );
      }

      const attempts: NoProviderAvailableError['attempts'] = [];
      for (const item of tracked) {
        const { state } = stateOf(item);
        const providerId = item.entry.client.id;
        if (state !== 'ready') {
          attempts.push({ providerId, outcome: state });
          continue;
        }
        const result = await attempt(item, request);
        if ('reply' in result) return { reply: result.reply, providerId };
        attempts.push({ providerId, outcome: result.failure });
      }
      throw new NoProviderAvailableError(attempts);
    },
  };
}

export type Failover = ReturnType<typeof createFailover>;
