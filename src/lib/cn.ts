/** Falsy branches are dropped, including the 0 that `flag && 'x'` yields when
 *  `flag` is an IndexedDB 0/1 boolean. */
type ClassValue = string | false | null | undefined | 0

export function cn(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(' ')
}
