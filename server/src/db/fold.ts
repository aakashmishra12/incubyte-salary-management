/**
 * Makes text comparable for a search: no capital letters and no accents, so "jose" finds "José"
 * and "ÉMILIE" finds "Émilie". SQLite's own LIKE only ignores the case of English letters.
 * NFD splits "é" into "e" plus a separate accent mark, and the accent marks (\p{M}) are removed.
 */
export function foldText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
