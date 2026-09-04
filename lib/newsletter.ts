import type { RecItem, ResearchItem } from "./types";

export function brokerageLabel(brokerages: string[]): string {
  const head = brokerages.slice(0, 3).join("·");
  return brokerages.length > 3 ? `${head} 외, ${brokerages.length}곳` : `${head}, ${brokerages.length}곳`;
}

function companyLine(r: RecItem): string {
  let line = `• ${r.stock} — ${r.leadComment} (${brokerageLabel(r.brokerages)})`;
  if (typeof r.targetPriceChangePct === "number" && r.targetPriceChangePct !== 0) {
    const sign = r.targetPriceChangePct > 0 ? "+" : "";
    line += ` / 목표가 ${sign}${r.targetPriceChangePct}%`;
  }
  return line;
}

export interface NewsletterInput {
  dateLabel: string;
  company: RecItem[];
  market: ResearchItem[];
  chatroomExtra?: { stock: string; note: string }[];
  chatroomRaw?: string;
}

export function buildNewsletter(input: NewsletterInput): string {
  const placed = new Set<RecItem>();
  const take = (pred: (r: RecItem) => boolean) =>
    input.company.filter((r) => !placed.has(r) && pred(r)).map((r) => (placed.add(r), r));

  const targetSec = take((r) => r.tags.includes("target-up") || r.tags.includes("target-down"));
  const newSec = take((r) => r.tags.includes("new-coverage"));
  const multiSec = take((r) => r.mentionCount >= 2);

  const blocks: string[] = [`📈 오늘의 증권가 브리핑 · ${input.dateLabel}`];
  const section = (title: string, lines: string[]) => {
    if (lines.length) blocks.push(`[${title}]\n${lines.join("\n")}`);
  };

  section("목표가·투자의견 변경", targetSec.map(companyLine));
  section("여러 증권사 주목", multiSec.map(companyLine));
  section("시황", input.market.map((m) => `• ${m.title} — ${m.brokerage}`));
  section("신규 커버리지", newSec.map(companyLine));

  const chatLines =
    input.chatroomExtra?.length
      ? input.chatroomExtra.map((c) => `• ${c.stock} — ${c.note}`)
      : input.chatroomRaw?.trim()
        ? [`• ${input.chatroomRaw.trim()}`]
        : [];
  section("단톡방 언급", chatLines);

  blocks.push(`────────\n※ 자료: 네이버 금융 리서치, 한경 컨센서스`);
  return blocks.join("\n\n");
}
