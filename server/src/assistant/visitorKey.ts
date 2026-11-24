/**
 * Turns the address of whoever is asking into the name the limits are counted under.
 * - An IPv4 address is used as it is, and so is one that arrives in IPv6 form.
 * - For IPv6, everyone in the same /64 is one visitor. One person or one home usually owns a
 *   whole /64, which holds billions of addresses, so counting single addresses would let them
 *   appear as endless new visitors.
 */
export function visitorKeyFor(address: string | undefined): string {
  if (!address) return 'unknown';

  // Drop an interface name such as "%en0", which only means something on one machine.
  const ip = address.split('%')[0]!.toLowerCase();

  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1]!;
  if (!ip.includes(':')) return ip || 'unknown';

  // Spell out the "::" shortcut so the first four groups can be read off.
  const [head = '', tail = ''] = ip.split('::');
  const headGroups = head === '' ? [] : head.split(':');
  const tailGroups = tail === '' || !ip.includes('::') ? [] : tail.split(':');
  const missing = Math.max(0, 8 - headGroups.length - tailGroups.length);
  const groups = [...headGroups, ...Array<string>(missing).fill('0'), ...tailGroups];

  // Groups are written without leading zeros, so "0db8" and "db8" are the same key.
  const firstFour = groups.slice(0, 4).map((group) => group.replace(/^0+(?=.)/, '') || '0');
  return `${firstFour.join(':')}::/64`;
}
