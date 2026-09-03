import type { ResearchItem } from "./types";

const BROKERAGE_ALIASES: Record<string, string> = {
  "미래에셋증권": "미래에셋", "삼성증권": "삼성", "KB증권": "KB", "NH투자증권": "NH",
  "한국투자증권": "한국투자", "키움증권": "키움", "신한투자증권": "신한", "하나증권": "하나",
  "대신증권": "대신", "메리츠증권": "메리츠", "유안타증권": "유안타", "교보증권": "교보",
  "IBK투자증권": "IBK", "SK증권": "SK", "현대차증권": "현대차", "DB금융투자": "DB",
  "하이투자증권": "하이", "이베스트투자증권": "이베스트", "다올투자증권": "다올",
  "유진투자증권": "유진", "BNK투자증권": "BNK", "상상인증권": "상상인",
};

export function normalizeStock(name: string): string {
  return name.replace(/\(\d{4,6}\)\s*$/, "").replace(/\s+/g, "").trim();
}

export function normalizeBrokerage(name: string): string {
  const t = name.replace(/\s+/g, " ").trim();
  return BROKERAGE_ALIASES[t] ?? t;
}

function titleKey(title: string): string {
  return title.replace(/[\s()[\]{}·,.:;~\-—]/g, "").toLowerCase();
}

export function dedupeItems(items: ResearchItem[]): ResearchItem[] {
  const groups = new Map<string, ResearchItem>();
  for (const it of items) {
    const k = titleKey(it.title);
    // find an existing item with same stock+brokerage whose title key is a prefix/suffix of this one
    let mergedKey: string | null = null;
    for (const [gk, g] of groups) {
      if (g.stock !== it.stock || g.brokerage !== it.brokerage) continue;
      const a = titleKey(g.title);
      if (a === k || a.includes(k) || k.includes(a)) { mergedKey = gk; break; }
    }
    if (mergedKey) {
      const g = groups.get(mergedKey)!;
      groups.set(mergedKey, {
        ...g,
        title: g.title.length >= it.title.length ? g.title : it.title,
        targetPrice: g.targetPrice ?? it.targetPrice,
        opinion: g.opinion ?? it.opinion,
        sourceUrl: g.sourceUrl.includes(it.sourceUrl) ? g.sourceUrl : `${g.sourceUrl} ${it.sourceUrl}`,
      });
    } else {
      groups.set(`${it.stock}|${it.brokerage}|${k}|${groups.size}`, { ...it });
    }
  }
  return [...groups.values()];
}
