import { describe, expect, it } from 'vitest';
import { foldText } from './fold.ts';

describe('foldText', () => {
  it('ignores upper and lower case', () => {
    expect(foldText('Kenji SATO')).toBe('kenji sato');
  });

  it('ignores accents, so a search for "jose" finds "José"', () => {
    expect(foldText('José Núñez')).toBe('jose nunez');
    expect(foldText('ÉMILIE')).toBe('emilie');
  });

  it('works on text that was typed with a separate accent mark', () => {
    // "e" followed by a combining acute accent, which looks the same as "é".
    expect(foldText('Rémy')).toBe('remy');
  });

  it('leaves text without letters alone', () => {
    expect(foldText('E00042')).toBe('e00042');
    expect(foldText('100%_\\')).toBe('100%_\\');
  });
});
