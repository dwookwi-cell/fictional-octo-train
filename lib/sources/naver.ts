import * as cheerio from "cheerio";
import type { ResearchItem, ResearchKind } from "@/lib/types";
import { parseLooseKoreanDate } from "@/lib/dates";
import { normalizeStock, normalizeBrokerage } from "@/lib/normalize";

const BASE = "https://finance.naver.com/research/";

const PAGES: Record<ResearchKind, string> = {
  company: "company_list.naver",
  industry: "industry_list.naver",
  market: "market_info_list.naver",
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * Parse one Naver Finance research list page into ResearchItems.
 *
 * The list is a single `<table class="type_1">`. Real data rows have 6 cells for
 * company/industry and 5 for market; 1-cell rows are spacers. Column order, read
 * from the fixtures, is:
 *   company : [종목명, 제목, 증권사, 첨부, 작성일, 조회수]
 *   industry: [업종,   제목, 증권사, 첨부, 작성일, 조회수]
 *   market  : [제목,         증권사, 첨부, 작성일, 조회수]
 * so from the right the layout is always: ..., 증권사, 첨부, 작성일, 조회수.
 * The title/href comes from the row's `*_read.naver` anchor.
 */
export function parseNaverList(html: string, kind: ResearchKind): ResearchItem[] {
  const $ = cheerio.load(html);
  const out: ResearchItem[] = [];

  $("table.type_1 tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 5) return; // spacer / header rows

    const cells = tds.toArray().map((td) => $(td).text().replace(/\s+/g, " ").trim());
    const anchors = $(tr).find("a").toArray();

    const readLink = anchors.find((a) => /_read\.naver/.test($(a).attr("href") ?? ""));
    if (!readLink) return;
    const title = $(readLink).text().replace(/\s+/g, " ").trim();
    const href = $(readLink).attr("href") ?? "";
    if (!title) return;

    // From the right: 증권사, 첨부, 작성일, 조회수
    const brokerageRaw = cells[cells.length - 4] ?? "";
    const dateRaw = cells[cells.length - 2] ?? "";
    const date = parseLooseKoreanDate(dateRaw);
    if (!date || !brokerageRaw) return;

    let stock: string;
    if (kind === "company") {
      const stockLink = anchors.find((a) => /\/item\/main\.naver/.test($(a).attr("href") ?? ""));
      stock = normalizeStock(($(stockLink).text() || cells[0]).trim());
    } else if (kind === "industry") {
      stock = cells[0] || title; // 업종 label, e.g. "반도체"
    } else {
      stock = title; // market reports have no per-stock dimension
    }
    if (!stock) return;

    out.push({
      stock,
      title,
      brokerage: normalizeBrokerage(brokerageRaw),
      date,
      sourceSite: "naver",
      sourceUrl: href.startsWith("http") ? href : BASE + href.replace(/^\//, ""),
      kind,
    });
  });

  return out;
}

/**
 * Fetch all three Naver Finance research list pages and parse them.
 * A per-page fetch/parse failure is swallowed (that page contributes nothing).
 */
export async function fetchNaverResearch(fetchImpl: typeof fetch = fetch): Promise<ResearchItem[]> {
  const kinds: ResearchKind[] = ["company", "industry", "market"];
  const results = await Promise.all(
    kinds.map(async (kind) => {
      try {
        const res = await fetchImpl(BASE + PAGES[kind], { headers: { "User-Agent": UA } });
        if (!res.ok) return [];
        const buf = await res.arrayBuffer();
        const html = new TextDecoder("euc-kr").decode(buf);
        return parseNaverList(html, kind);
      } catch {
        return [];
      }
    }),
  );
  return results.flat();
}
