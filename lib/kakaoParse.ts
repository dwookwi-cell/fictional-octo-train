import { normalizeStock } from "./normalize";
import { BASE_STOCKS } from "./stockDictionary";

export function parseChatroom(
  text: string,
  extraDictionary: string[] = [],
): { matchedStocks: string[]; rawText: string } {
  const rawText = text.trim();
  const haystack = rawText.replace(/\s+/g, "").toLowerCase();
  const dict = [...new Set([...BASE_STOCKS, ...extraDictionary])]
    .filter((s) => s && normalizeStock(s).length >= 2)
    // longer names first so "삼성바이오로직스" wins before "삼성"
    .sort((a, b) => b.length - a.length);

  const seen = new Set<string>();
  const ordered: { name: string; at: number }[] = [];
  for (const name of dict) {
    const needle = normalizeStock(name).toLowerCase();
    const at = haystack.indexOf(needle);
    if (at >= 0 && !seen.has(normalizeStock(name))) {
      seen.add(normalizeStock(name));
      ordered.push({ name: normalizeStock(name), at });
    }
  }
  ordered.sort((a, b) => a.at - b.at);
  return { matchedStocks: ordered.map((o) => o.name), rawText };
}
