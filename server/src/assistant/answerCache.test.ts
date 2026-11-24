import { describe, expect, it } from 'vitest';
import { createAnswerCache, normalizeQuestion } from './answerCache.ts';
import { CACHE_MAX_ENTRIES, CACHE_TTL_SECONDS } from './buildAssistant.ts';

function aClock() {
  let now = new Date('2026-11-24T10:00:00Z').getTime();
  return { now: () => new Date(now), advance: (seconds: number) => (now += seconds * 1000) };
}

describe('normalizeQuestion', () => {
  it('treats case, spacing and a final question mark as the same question', () => {
    const a = normalizeQuestion('Who is paid the most in India?');
    const b = normalizeQuestion('  who is paid   the MOST in india ');

    expect(a).toBe(b);
  });

  it('keeps different questions different', () => {
    expect(normalizeQuestion('paid most in India')).not.toBe(
      normalizeQuestion('paid most in Japan'),
    );
  });
});

describe('createAnswerCache', () => {
  it('returns what was stored for the same question and data version', () => {
    const cache = createAnswerCache({ maxEntries: 10, ttlSeconds: 3600, clock: aClock().now });
    cache.set('who is paid most', 7, 'auto', { answer: 'A' });

    expect(cache.get('who is paid most', 7, 'auto')).toEqual({ answer: 'A' });
  });

  it('finds nothing after the data has changed, because the version is part of the key', () => {
    const cache = createAnswerCache({ maxEntries: 10, ttlSeconds: 3600, clock: aClock().now });
    cache.set('q', 7, 'auto', { answer: 'A' });

    expect(cache.get('q', 8, 'auto')).toBeUndefined();
  });

  it('keeps answers from different chosen providers apart', () => {
    const cache = createAnswerCache({ maxEntries: 10, ttlSeconds: 3600, clock: aClock().now });
    cache.set('q', 1, 'groq', { answer: 'from groq' });

    expect(cache.get('q', 1, 'openrouter')).toBeUndefined();
  });

  it('forgets an answer after its time is up', () => {
    const clock = aClock();
    const cache = createAnswerCache({ maxEntries: 10, ttlSeconds: 60, clock: clock.now });
    cache.set('q', 1, 'auto', { answer: 'A' });

    clock.advance(61);

    expect(cache.get('q', 1, 'auto')).toBeUndefined();
  });

  it('drops the oldest answer when it is full', () => {
    const cache = createAnswerCache({ maxEntries: 2, ttlSeconds: 3600, clock: aClock().now });
    cache.set('one', 1, 'auto', { answer: '1' });
    cache.set('two', 1, 'auto', { answer: '2' });
    cache.set('three', 1, 'auto', { answer: '3' });

    expect(cache.get('one', 1, 'auto')).toBeUndefined();
    expect(cache.get('two', 1, 'auto')).toEqual({ answer: '2' });
    expect(cache.size()).toBe(2);
  });

  it('does not grow when the same question is stored again', () => {
    const cache = createAnswerCache({ maxEntries: 2, ttlSeconds: 3600, clock: aClock().now });
    cache.set('one', 1, 'auto', { answer: '1' });
    cache.set('one', 1, 'auto', { answer: '1 again' });

    expect(cache.size()).toBe(1);
    expect(cache.get('one', 1, 'auto')).toEqual({ answer: '1 again' });
  });

  it('treats a question stored again as the newest, so it is not the next one dropped', () => {
    const cache = createAnswerCache({ maxEntries: 2, ttlSeconds: 3600, clock: aClock().now });
    cache.set('a', 1, 'auto', { answer: 'a' });
    cache.set('b', 1, 'auto', { answer: 'b' });
    cache.set('a', 1, 'auto', { answer: 'a again' });

    cache.set('c', 1, 'auto', { answer: 'c' });

    expect(cache.get('a', 1, 'auto')).toEqual({ answer: 'a again' });
    expect(cache.get('b', 1, 'auto')).toBeUndefined();
  });

  it('keeps an answer for the whole of its lifetime and not a second more', () => {
    const clock = aClock();
    const cache = createAnswerCache({ maxEntries: 10, ttlSeconds: 60, clock: clock.now });
    cache.set('q', 1, 'auto', { answer: 'A' });

    clock.advance(59);
    expect(cache.get('q', 1, 'auto')).toEqual({ answer: 'A' });
    clock.advance(1);
    expect(cache.get('q', 1, 'auto')).toBeUndefined();
  });
});

describe('the cache the assistant is built with', () => {
  it('holds at most 100 answers, for at most an hour, as the spec promises', () => {
    expect(CACHE_MAX_ENTRIES).toBe(100);
    expect(CACHE_TTL_SECONDS).toBe(3600);
  });
});
