import type { ResearchItem, RecItem, RecTag } from "./types";
import { normalizeStock } from "./normalize";

export interface RecommendInput {
  items: ResearchItem[];
  watchlist: string[];
  chatroomStocks: string[];
  prevTargetPrices?: Record<string, number>;
}
export interface RecommendOutput {
  company: RecItem[];
  industry: RecItem[];
  market: ResearchItem[];
}

const RE_UP = /상향|올려|상승\s*여력|목표가.*(상향|↑)/;
const RE_DOWN = /하향|내려|목표가.*(하향|↓)/;
const RE_NEW = /커버리지\s*(개시|재개)|신규\s*편입|Initiat(e|ion)/i;

function groupByStock(items: ResearchItem[]): Map<string, ResearchItem[]> {
  const m = new Map<string, ResearchItem[]>();
  for (const it of items) {
    const key = normalizeStock(it.stock);
    (m.get(key) ?? m.set(key, []).get(key)!).push(it);
  }
  return m;
}

function buildRec(
  stock: string,
  items: ResearchItem[],
  watch: Set<string>,
  chat: Set<string>,
  prev: Record<string, number>,
): RecItem {
  const brokerages = [...new Set(items.map((i) => i.brokerage))];
  const mentionCount = brokerages.length;
  const isWatchlist = watch.has(stock);
  const tags: RecTag[] = [];
  if (items.some((i) => RE_UP.test(i.title))) tags.push("target-up");
  if (items.some((i) => RE_DOWN.test(i.title))) tags.push("target-down");
  if (items.some((i) => RE_NEW.test(i.title))) tags.push("new-coverage");
  if (isWatchlist) tags.push("watchlist");
  if (chat.has(stock)) tags.push("chatroom");

  const byNewest = [...items].sort((a, b) => b.date.localeCompare(a.date));
  const lead = byNewest.find((i) => /상향|하향|목표가/.test(i.title)) ?? byNewest[0];

  const prevTp = prev[stock];
  const curTp = byNewest.find((i) => typeof i.targetPrice === "number")?.targetPrice;
  const targetPriceChangePct =
    prevTp && curTp ? Math.round(((curTp - prevTp) / prevTp) * 100) : undefined;

  const special = tags.some((t) => t === "target-up" || t === "target-down" || t === "new-coverage" || t === "chatroom");
  const hidden = mentionCount < 2 && !isWatchlist && !special;
  const score =
    (isWatchlist ? 1000 : 0) +
    mentionCount * 10 +
    (tags.includes("target-up") || tags.includes("target-down") ? 5 : 0) +
    (tags.includes("new-coverage") ? 3 : 0);

  return {
    stock, mentionCount, brokerages, items: byNewest,
    leadComment: lead.title, leadBrokerage: lead.brokerage,
    tags, targetPriceChangePct, isWatchlist, hidden, score,
  };
}

export function recommend(input: RecommendInput): RecommendOutput {
  const watch = new Set(input.watchlist.map(normalizeStock));
  const chat = new Set(input.chatroomStocks.map(normalizeStock));
  const prev = input.prevTargetPrices ?? {};

  const company = [...groupByStock(input.items.filter((i) => i.kind === "company"))]
    .map(([stock, items]) => buildRec(stock, items, watch, chat, prev))
    .sort(
      (a, b) =>
        Number(b.isWatchlist) - Number(a.isWatchlist) ||
        b.mentionCount - a.mentionCount ||
        a.stock.localeCompare(b.stock),
    );

  const industry = [...groupByStock(input.items.filter((i) => i.kind === "industry"))]
    .map(([stock, items]) => buildRec(stock, items, watch, chat, prev))
    .sort((a, b) => b.mentionCount - a.mentionCount || a.stock.localeCompare(b.stock));

  const market = input.items
    .filter((i) => i.kind === "market")
    .sort((a, b) => b.date.localeCompare(a.date));

  return { company, industry, market };
}
