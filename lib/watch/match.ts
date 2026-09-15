/**
 * Keyword matching for the used-goods watcher.
 *
 * "키워드 일치시" — a listing counts as a hit when one of the watch keywords
 * appears in its title, ignoring case and any spaces/hyphens/underscores so
 * that "PM-10", "PM10" and "pm 10" are all treated as the same term. Matching
 * is substring-based, so "PM10" also matches "PM100"; keep keywords specific.
 */

export function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[\s\-_]+/g, "");
}

export function matchesAnyKeyword(text: string, keywords: string[]): boolean {
  const haystack = normalizeForMatch(text);
  return keywords.some((kw) => {
    const needle = normalizeForMatch(kw);
    return needle.length > 0 && haystack.includes(needle);
  });
}
