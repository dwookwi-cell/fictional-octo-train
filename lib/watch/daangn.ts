/**
 * 당근마켓 (daangn.com) used-goods search — fetch + parse.
 *
 * The public search page `https://www.daangn.com/kr/buy-sell/s/?in=<region>&search=<kw>`
 * renders its result list on the client from a JSON blob embedded as
 * `window.__remixContext = {...};</script>`. The listings live at
 *   state.loaderData["routes/kr.buy-sell.s"].allPage.fleamarketArticles
 * Each article carries { href, title, price, status, createdAt, region.name }.
 *
 * Like the research sources in lib/sources/*, fetchDaangnSearch never throws:
 * any network / shape problem yields [] so a watch run degrades quietly.
 */

const ORIGIN = "https://www.daangn.com";
const SEARCH_PATH = "/kr/buy-sell/s/";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface DaangnListing {
  id: string; // stable short id from the article href tail
  title: string;
  price: number | null; // KRW; null for 나눔 / 가격제안
  region: string; // 동 name, e.g. "송도동"
  url: string; // absolute article URL
  createdAt: string; // ISO 8601, "" when absent
  status: string; // "Ongoing" | "Reserved" | "Closed" | ...
}

interface RawArticle {
  href?: string;
  id?: string;
  title?: string;
  price?: string;
  status?: string;
  createdAt?: string;
  region?: { name?: string } | null;
}

function idFromHref(href: string): string {
  const tail = href.replace(/\/+$/, "").split("/").pop() ?? "";
  const token = tail.split("-").pop() ?? "";
  return token || href;
}

function toListing(a: RawArticle): DaangnListing | null {
  const href = a.href || a.id || "";
  const title = (a.title || "").trim();
  if (!href || !title) return null;
  const priceNum = Number(a.price);
  return {
    id: idFromHref(href),
    title,
    price: a.price && Number.isFinite(priceNum) && priceNum > 0 ? priceNum : null,
    region: a.region?.name?.trim() || "",
    url: href.startsWith("http") ? href : ORIGIN + href,
    createdAt: typeof a.createdAt === "string" ? a.createdAt : "",
    status: (a.status || "").trim(),
  };
}

export function parseDaangnListings(html: string): DaangnListing[] {
  const m = html.match(/window\.__remixContext\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!m) return [];
  let ctx: unknown;
  try {
    ctx = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const loaderData = (ctx as { state?: { loaderData?: Record<string, unknown> } })?.state
    ?.loaderData;
  const route = loaderData?.["routes/kr.buy-sell.s"] as
    | { allPage?: { fleamarketArticles?: RawArticle[] } }
    | undefined;
  const articles = route?.allPage?.fleamarketArticles;
  if (!Array.isArray(articles)) return [];
  return articles.map(toListing).filter((x): x is DaangnListing => x !== null);
}

export interface DaangnSearchOpts {
  /** 당근 `in` slug, e.g. "송도동-6543". */
  regionSlug: string;
}

/**
 * Fetch one keyword search.
 *
 * Returns the parsed listings (possibly an empty array when 당근 simply has no
 * results for a niche term) on success, or `null` when the request itself
 * failed — a non-ok response or a thrown error. Callers use the null vs.
 * empty-array distinction to tell "당근 unreachable / blocked" apart from
 * "reached 당근, nothing matched".
 */
export async function fetchDaangnSearch(
  keyword: string,
  opts: DaangnSearchOpts,
  fetchImpl: typeof fetch = fetch,
): Promise<DaangnListing[] | null> {
  const url = `${ORIGIN}${SEARCH_PATH}?in=${encodeURIComponent(opts.regionSlug)}&search=${encodeURIComponent(keyword)}`;
  try {
    const res = await fetchImpl(url, {
      headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" },
    });
    if (!res.ok) return null;
    return parseDaangnListings(await res.text());
  } catch {
    return null;
  }
}
