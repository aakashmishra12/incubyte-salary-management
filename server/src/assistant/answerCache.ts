export interface AnswerCacheOptions {
  maxEntries: number;
  ttlSeconds: number;
  clock: () => Date;
}

/**
 * "Who is paid the most in India?" and "  who is paid the MOST in india " are the same question.
 * Case, repeated spaces and a closing question mark or full stop do not matter.
 */
export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[?!.\s]+$/, '')
    .trim();
}

/**
 * Remembers answers so a repeated question costs no model call.
 * The data version is part of the key, so as soon as any employee data changes, every
 * earlier answer stops matching. Nothing has to remember to clear the cache.
 * <T> is whatever the caller stores, which keeps this file free of assistant details.
 */
export function createAnswerCache<T>({ maxEntries, ttlSeconds, clock }: AnswerCacheOptions) {
  const entries = new Map<string, { value: T; expiresAt: number }>();

  const keyOf = (question: string, dataVersion: number, provider: string) =>
    `${provider}|${dataVersion}|${normalizeQuestion(question)}`;

  return {
    get(question: string, dataVersion: number, provider: string): T | undefined {
      const key = keyOf(question, dataVersion, provider);
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= clock().getTime()) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },

    set(question: string, dataVersion: number, provider: string, value: T): void {
      const key = keyOf(question, dataVersion, provider);
      // Storing again moves the entry to the back, so the oldest is always at the front.
      entries.delete(key);
      if (entries.size >= maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
      entries.set(key, { value, expiresAt: clock().getTime() + ttlSeconds * 1000 });
    },

    size: () => entries.size,
  };
}

export type AnswerCache<T> = ReturnType<typeof createAnswerCache<T>>;
