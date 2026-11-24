const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface UsageLimiterOptions {
  perVisitorPerHour: number;
  perDay: number;
  /** How many visitors are remembered at once. The memory use is bounded by this. */
  maxVisitors?: number;
  clock: () => Date;
}

/**
 * Proof of which hour and which day a question was charged to. Giving a question back needs it,
 * so a late refund can never take a question from a later hour or day.
 */
export interface UsageTicket {
  readonly visitorId: string;
  readonly windowStart: number;
  readonly dayKey: string;
  refunded: boolean;
}

export type UsageDecision =
  | { allowed: true; remainingThisHour: number; ticket: UsageTicket }
  | {
      allowed: false;
      /** visitor: this person used their hour. daily: everyone used the day. busy: too many people at once. */
      reason: 'visitor' | 'daily' | 'busy';
      retryAfterSeconds: number;
    };

/**
 * Decides whether a question may use the paid or free model allowance.
 * Two limits apply: each visitor gets an allowance that starts at their first question
 * and lasts an hour, and everyone together gets an allowance per UTC day.
 * Everything is in memory, so a restart resets it.
 */
export function createUsageLimiter({
  perVisitorPerHour,
  perDay,
  maxVisitors = 10_000,
  clock,
}: UsageLimiterOptions) {
  const visitors = new Map<string, { count: number; windowStart: number }>();
  let day = { key: '', count: 0 };

  const secondsUntil = (target: number, now: number) =>
    Math.max(1, Math.ceil((target - now) / 1000));

  return {
    tryUse(visitorId: string): UsageDecision {
      const nowDate = clock();
      const now = nowDate.getTime();

      const dayKey = nowDate.toISOString().slice(0, 10);
      if (dayKey !== day.key) day = { key: dayKey, count: 0 };

      // Forget visitors whose hour is over, but only when the table is full.
      if (visitors.size >= maxVisitors) {
        for (const [id, entry] of visitors) {
          if (entry.windowStart + HOUR_MS <= now) visitors.delete(id);
        }
      }

      let entry = visitors.get(visitorId);
      if (entry && entry.windowStart + HOUR_MS <= now) {
        visitors.delete(visitorId);
        entry = undefined;
      }

      // Both limits are checked before either is used, so a refused question costs nothing.
      if (day.count >= perDay) {
        const midnight =
          Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate()) + DAY_MS;
        return { allowed: false, reason: 'daily', retryAfterSeconds: secondsUntil(midnight, now) };
      }
      if (entry && entry.count >= perVisitorPerHour) {
        return {
          allowed: false,
          reason: 'visitor',
          retryAfterSeconds: secondsUntil(entry.windowStart + HOUR_MS, now),
        };
      }
      if (!entry && visitors.size >= maxVisitors) {
        const soonest = Math.min(...[...visitors.values()].map((v) => v.windowStart + HOUR_MS));
        return { allowed: false, reason: 'busy', retryAfterSeconds: secondsUntil(soonest, now) };
      }

      if (!entry) {
        entry = { count: 0, windowStart: now };
        visitors.set(visitorId, entry);
      }
      entry.count += 1;
      day.count += 1;
      return {
        allowed: true,
        remainingThisHour: perVisitorPerHour - entry.count,
        ticket: { visitorId, windowStart: entry.windowStart, dayKey: day.key, refunded: false },
      };
    },

    /** How many questions a visitor can still ask this hour. Does not use one. */
    remaining(visitorId: string): number {
      const entry = visitors.get(visitorId);
      if (!entry || entry.windowStart + HOUR_MS <= clock().getTime()) return perVisitorPerHour;
      return Math.max(0, perVisitorPerHour - entry.count);
    },

    /**
     * Gives back a question that could not be answered, for example because every provider was
     * down. Only the hour and the day the question was charged to are touched, and a ticket
     * can be given back once.
     */
    refund(ticket: UsageTicket): void {
      if (ticket.refunded) return;
      ticket.refunded = true;

      const entry = visitors.get(ticket.visitorId);
      if (entry && entry.windowStart === ticket.windowStart && entry.count > 0) {
        entry.count -= 1;
        // A visitor with no questions left to count takes no room in the table.
        if (entry.count === 0) visitors.delete(ticket.visitorId);
      }
      if (day.key === ticket.dayKey && day.count > 0) day.count -= 1;
    },

    /** The limits this limiter enforces, so a caller can report them. */
    limits: { perVisitorPerHour, perDay },

    trackedVisitors: () => visitors.size,
  };
}

export type UsageLimiter = ReturnType<typeof createUsageLimiter>;
