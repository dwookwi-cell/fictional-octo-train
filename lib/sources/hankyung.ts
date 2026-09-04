import * as cheerio from "cheerio";
import type { ResearchItem, ResearchKind } from "@/lib/types";
import { parseLooseKoreanDate } from "@/lib/dates";
import { normalizeStock, normalizeBrokerage } from "@/lib/normalize";

const BASE = "https://consensus.hankyung.com";
// "전체" list: the only Hankyung view that carries a 분류 column, so it is the
// only one from which parseHankyungList(html) alone can classify all 3 kinds.
// pagenum=80 = max page size. No sdate/edate -> server returns "today".
const LIST_URL = `${BASE}/analysis/list?pagenum=80`;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function kindOf(category: string): ResearchKind {
  if (/기업|종목/.test(category)) return "company";
  if (/산업|업종/.test(category)) return "industry";
  return "market"; // 시장/시황/경제/채권/파생/외환/해외/기타
}

function toNumber(raw: string): number | undefined {
  const n = Number(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Parse a Hankyung Consensus list page into ResearchItems.
 *
 * The list is a single `<table>` inside `div.table_style01`. Columns vary by
 * view, so we read the `<thead>` labels and address every cell positionally by
 * header name rather than by a content-sniffing regex:
 *   전체      : 작성일 | 분류 | 제목 | 작성자 | 제공출처 | 첨부파일
 *   기업(skin): 작성일 | 제목 | 적정가격 | 투자의견 | 작성자 | 제공출처 | 기업정보 | 차트 | 첨부파일
 *   산업(skin): 작성일 | 제목 | 투자의견 | 작성자 | 제공출처 | 차트 | 첨부파일
 *   시장(skin): 작성일 | 제목 | 작성자 | 제공출처 | 차트 | 첨부파일
 * The title/href come from the row's `analysis/downpdf?report_idx=` anchor.
 * `분류` drives `kind`; when the view has no 분류 column (a skin view) the active
 * tab label is the fallback. `적정가격`/`투자의견` are filled only when present.
 */
export function parseHankyungList(html: string): ResearchItem[] {
  const $ = cheerio.load(html);
  const out: ResearchItem[] = [];

  const headers = $(".table_style01 thead th").toArray().map((th) => clean($(th).text()));
  const col = (name: string) => headers.findIndex((h) => h.includes(name));
  const iCategory = col("분류");
  const iBrokerage = col("제공출처");
  const iDate = col("작성일");
  const iTarget = headers.findIndex((h) => /적정가격|목표가/.test(h));
  const iOpinion = col("투자의견");

  // Fallback kind (skin views have no 분류 cell): active tab in the top nav.
  const activeTab = clean($(".tabT01 li[class*='on'] a").first().text());

  $(".table_style01 tbody tr").each((_, tr) => {
    const cells = $(tr).find("td").toArray().map((td) => clean($(td).text()));
    if (cells.length < 4) return; // spacer / malformed row

    const anchor = $(tr).find("a[href*='downpdf'], td.text_l a").first();
    const title = clean(anchor.text());
    if (!title) return;

    const dateRaw = iDate >= 0 ? cells[iDate] : cells[0];
    const date = parseLooseKoreanDate(dateRaw);
    if (!date) return;

    const brokerageRaw = iBrokerage >= 0 ? cells[iBrokerage] : cells[cells.length - 2];
    if (!brokerageRaw) return;

    const category = iCategory >= 0 ? cells[iCategory] : activeTab;
    const kind = kindOf(category);

    const opinionRaw = iOpinion >= 0 ? cells[iOpinion] : "";
    const opinion = opinionRaw && !/^N\/?A$/i.test(opinionRaw) ? opinionRaw : undefined;

    const targetPrice = iTarget >= 0 ? toNumber(cells[iTarget] ?? "") : undefined;

    const href = anchor.attr("href") ?? "";
    const stock =
      kind === "company" ? normalizeStock(title.split(/[\s(]/)[0]) : title;

    out.push({
      stock,
      title,
      brokerage: normalizeBrokerage(brokerageRaw),
      targetPrice,
      opinion,
      date,
      sourceSite: "hankyung",
      sourceUrl: href.startsWith("http")
        ? href
        : BASE + (href.startsWith("/") ? href : `/${href}`),
      kind,
    });
  });

  return out;
}

/**
 * Fetch the Hankyung Consensus "전체" list and parse it.
 * Any fetch/parse failure is swallowed (returns []).
 */
export async function fetchHankyungConsensus(
  fetchImpl: typeof fetch = fetch,
): Promise<ResearchItem[]> {
  try {
    const res = await fetchImpl(LIST_URL, { headers: { "User-Agent": UA } });
    if (!res.ok) return [];
    return parseHankyungList(await res.text());
  } catch {
    return [];
  }
}
