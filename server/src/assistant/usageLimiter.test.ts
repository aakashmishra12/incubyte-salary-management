import { describe, expect, it } from 'vitest';
import { createUsageLimiter } from './usageLimiter.ts';

/** A clock the test moves by hand. */
function aClock(start = '2026-11-24T10:00:00Z') {
  let now = new Date(start).getTime();
  return {
    now: () => new Date(now),
    advance: (seconds: number) => (now += seconds * 1000),
  };
}

const limits = { perVisitorPerHour: 3, perDay: 5 };

describe('createUsageLimiter', () => {
  it('lets a visitor ask up to the hourly limit and says how many are left', () => {
    const limiter = createUsageLimiter({ ...limits, clock: aClock().now });

    expect(limiter.tryUse('a')).toMatchObject({ allowed: true, remainingThisHour: 2 });
    expect(limiter.tryUse('a')).toMatchObject({ allowed: true, remainingThisHour: 1 });
    expect(limiter.tryUse('a')).toMatchObject({ allowed: true, remainingThisHour: 0 });
  });

  it('refuses the next question and says when the hour is over', () => {
    const clock = aClock();
    const limiter = createUsageLimiter({ ...limits, clock: clock.now });
    for (let i = 0; i < 3; i++) limiter.tryUse('a');
    clock.advance(600);

    expect(limiter.tryUse('a')).toEqual({
      allowed: false,
      reason: 'visitor',
      retryAfterSeconds: 3000,
    });
  });

  it('gives the visitor a new allowance once their hour has passed', () => {
    const clock = aClock();
    const limiter = createUsageLimiter({ ...limits, clock: clock.now });
    for (let i = 0; i < 3; i++) limiter.tryUse('a');

    clock.advance(3600);

    expect(limiter.tryUse('a')).toMatchObject({ allowed: true, remainingThisHour: 2 });
  });

  it('counts each visitor separately', () => {
    const limiter = createUsageLimiter({ ...limits, clock: aClock().now });
    for (let i = 0; i < 3; i++) limiter.tryUse('a');

    expect(limiter.tryUse('b')).toMatchObject({ allowed: true });
  });

  it('refuses everyone once the daily limit is reached, and says when midnight UTC is', () => {
    const clock = aClock('2026-11-24T23:00:00Z');
    const limiter = createUsageLimiter({ perVisitorPerHour: 10, perDay: 2, clock: clock.now });
    limiter.tryUse('a');
    limiter.tryUse('b');

    expect(limiter.tryUse('c')).toEqual({
      allowed: false,
      reason: 'daily',
      retryAfterSeconds: 3600,
    });
  });

  it('starts a new day at midnight UTC', () => {
    const clock = aClock('2026-11-24T23:59:00Z');
    const limiter = createUsageLimiter({ perVisitorPerHour: 10, perDay: 1, clock: clock.now });
    limiter.tryUse('a');

    clock.advance(120);

    expect(limiter.tryUse('b')).toMatchObject({ allowed: true });
  });

  it('does not use up a visitor allowance when the daily limit refuses the question', () => {
    const clock = aClock();
    const limiter = createUsageLimiter({ perVisitorPerHour: 3, perDay: 1, clock: clock.now });
    limiter.tryUse('other');
    limiter.tryUse('a');
    limiter.tryUse('a');
    clock.advance(24 * 3600);

    // A new day: the refused questions above must not have been counted against 'a'.
    expect(limiter.tryUse('a')).toMatchObject({ allowed: true, remainingThisHour: 2 });
  });

  it('forgets visitors whose hour has passed, so memory does not grow without bound', () => {
    const clock = aClock();
    const limiter = createUsageLimiter({
      perVisitorPerHour: 3,
      perDay: 100_000,
      maxVisitors: 50,
      clock: clock.now,
    });
    for (let i = 0; i < 50; i++) limiter.tryUse(`old-${i}`);
    clock.advance(3601);

    limiter.tryUse('new');

    expect(limiter.trackedVisitors()).toBe(1);
  });

  it('says a refused visitor can try again when the earliest hour in the table ends', () => {
    const clock = aClock();
    const limiter = createUsageLimiter({
      perVisitorPerHour: 3,
      perDay: 100_000,
      maxVisitors: 2,
      clock: clock.now,
    });
    limiter.tryUse('a');
    clock.advance(600);
    limiter.tryUse('b');
    clock.advance(60);

    // 'a' started 660 seconds ago, so its hour ends in 2,940 seconds.
    expect(limiter.tryUse('c')).toEqual({
      allowed: false,
      reason: 'busy',
      retryAfterSeconds: 2_940,
    });
  });

  it('rounds the wait up to a whole second, so a visitor is never told to retry too early', () => {
    const clock = aClock();
    const limiter = createUsageLimiter({ ...limits, clock: clock.now });
    for (let i = 0; i < 3; i++) limiter.tryUse('a');
    clock.advance(3_599.5);

    expect(limiter.tryUse('a')).toMatchObject({
      allowed: false,
      reason: 'visitor',
      retryAfterSeconds: 1,
    });
  });

  it('refuses new visitors rather than growing past the limit when all are recent', () => {
    const limiter = createUsageLimiter({
      perVisitorPerHour: 3,
      perDay: 100_000,
      maxVisitors: 2,
      clock: aClock().now,
    });
    limiter.tryUse('a');
    limiter.tryUse('b');

    expect(limiter.tryUse('c')).toMatchObject({ allowed: false, reason: 'busy' });
    expect(limiter.trackedVisitors()).toBe(2);
  });

  describe('giving an allowance back and showing what is left', () => {
    /** The ticket that a granted question comes with. It says which hour and which day were charged. */
    function ticketOf(decision: ReturnType<ReturnType<typeof createUsageLimiter>['tryUse']>) {
      if (!decision.allowed) throw new Error('Expected the question to be allowed');
      return decision.ticket;
    }

    it('shows how many questions a visitor has left, without using one', () => {
      const limiter = createUsageLimiter({ ...limits, clock: aClock().now });
      limiter.tryUse('a');

      expect(limiter.remaining('a')).toBe(2);
      expect(limiter.remaining('a')).toBe(2);
      expect(limiter.remaining('never-seen')).toBe(3);
    });

    it('gives a question back to the visitor and to the day', () => {
      const limiter = createUsageLimiter({ perVisitorPerHour: 3, perDay: 1, clock: aClock().now });
      const ticket = ticketOf(limiter.tryUse('a'));

      limiter.refund(ticket);

      expect(limiter.remaining('a')).toBe(3);
      expect(limiter.tryUse('b')).toMatchObject({ allowed: true });
    });

    it('forgets a visitor completely when their only question is given back, so refusals cannot fill the table', () => {
      const limiter = createUsageLimiter({ ...limits, maxVisitors: 2, clock: aClock().now });
      const first = ticketOf(limiter.tryUse('a'));
      const second = ticketOf(limiter.tryUse('b'));

      limiter.refund(first);
      limiter.refund(second);

      expect(limiter.trackedVisitors()).toBe(0);
      expect(limiter.tryUse('c')).toMatchObject({ allowed: true });
    });

    it('does not take a question from the new hour when the ticket is from an earlier one', () => {
      const clock = aClock();
      const limiter = createUsageLimiter({ ...limits, clock: clock.now });
      const oldTicket = ticketOf(limiter.tryUse('a'));
      clock.advance(3601);
      limiter.tryUse('a');
      limiter.tryUse('a');

      limiter.refund(oldTicket);

      expect(limiter.remaining('a')).toBe(1);
    });

    it('does not take a question from the new day when the ticket is from the day before', () => {
      const clock = aClock('2026-11-24T23:59:00Z');
      const limiter = createUsageLimiter({ perVisitorPerHour: 10, perDay: 1, clock: clock.now });
      const oldTicket = ticketOf(limiter.tryUse('a'));
      clock.advance(120);
      limiter.tryUse('b');

      limiter.refund(oldTicket);

      expect(limiter.tryUse('c')).toMatchObject({ allowed: false, reason: 'daily' });
    });

    it('gives a ticket back only once', () => {
      const limiter = createUsageLimiter({ ...limits, clock: aClock().now });
      const ticket = ticketOf(limiter.tryUse('a'));
      limiter.tryUse('a');

      limiter.refund(ticket);
      limiter.refund(ticket);

      expect(limiter.remaining('a')).toBe(2);
    });
  });
});
