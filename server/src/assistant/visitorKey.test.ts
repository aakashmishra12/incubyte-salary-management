import { describe, expect, it } from 'vitest';
import { visitorKeyFor } from './visitorKey.ts';

describe('visitorKeyFor', () => {
  it('uses an IPv4 address as it is', () => {
    expect(visitorKeyFor('192.0.2.7')).toBe('192.0.2.7');
  });

  it('treats an IPv4 address that arrives in IPv6 form as the same visitor', () => {
    expect(visitorKeyFor('::ffff:192.0.2.7')).toBe('192.0.2.7');
  });

  it('counts every address in one IPv6 /64 as one visitor, because one person owns the whole range', () => {
    expect(visitorKeyFor('2001:db8:abcd:12:1:2:3:4')).toBe('2001:db8:abcd:12::/64');
    expect(visitorKeyFor('2001:db8:abcd:12:ffff:ffff:ffff:ffff')).toBe('2001:db8:abcd:12::/64');
  });

  it('understands the short form of an IPv6 address', () => {
    expect(visitorKeyFor('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(visitorKeyFor('::1')).toBe('0:0:0:0::/64');
  });

  it('ignores letter case and leading zeros, so one address has one key', () => {
    expect(visitorKeyFor('2001:0DB8:00AB:0012::5')).toBe('2001:db8:ab:12::/64');
  });

  it('drops an interface name after a percent sign', () => {
    expect(visitorKeyFor('fe80::1%en0')).toBe('fe80:0:0:0::/64');
  });

  it('gives one shared key when the address is unknown', () => {
    expect(visitorKeyFor(undefined)).toBe('unknown');
    expect(visitorKeyFor('')).toBe('unknown');
  });
});
