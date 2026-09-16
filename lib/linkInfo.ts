import * as cheerio from "cheerio";

export interface LinkInfo {
  title?: string;
  description?: string;
}

const MAX_LINKS = 30;
const TIMEOUT_MS = 8000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// ponytail: hand-kept list of hosts that only return a site name or block bots
// (measured 2026-09-15). Add new ones here as they turn up.
const SKIP_HOSTS = ["finance.naver.com", "markets.hankyung.com", "investing.com", "truthsocial.com"];

export function shouldSkip(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return true;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return true;
  const host = u.hostname.replace(/\.$/, "");
  // never let the server open internal addresses; news links are never bare IPs
  if (host === "localhost" || host.endsWith(".localhost") || host.startsWith("[") || /^\d+(\.\d+){3}$/.test(host)) {
    return true;
  }
  return SKIP_HOSTS.some((h) => host === h || host.endsWith("." + h));
}

export function decodeHtml(buf: ArrayBuffer, contentType: string | null): string {
  const utf8 = new TextDecoder("utf-8").decode(buf);
  const declared =
    contentType?.match(/charset=([\w-]+)/i)?.[1] ??
    utf8.slice(0, 4096).match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  return declared && /euc-?kr|ks_c_5601/i.test(declared) ? new TextDecoder("euc-kr").decode(buf) : utf8;
}

export function parseMeta(html: string): LinkInfo {
  const $ = cheerio.load(html);
  const title =
    $('meta[property="og:title"]').attr("content")?.trim() || $("title").first().text().trim() || undefined;
  const description = $('meta[property="og:description"]').attr("content")?.trim() || undefined;
  return { ...(title ? { title } : {}), ...(description ? { description } : {}) };
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECT_HOPS = 3;

export async function fetchLinkInfo(
  urls: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, LinkInfo>> {
  const targets = [...new Set(urls)].filter((u) => !shouldSkip(u)).slice(0, MAX_LINKS);
  const out: Record<string, LinkInfo> = {};
  await Promise.all(
    targets.map(async (url) => {
      try {
        // one shared timeout budget across all redirect hops for this link
        const signal = AbortSignal.timeout(TIMEOUT_MS);
        let current = url;
        let res: Response;
        let hops = 0;
        for (;;) {
          res = await fetchImpl(current, {
            headers: { "User-Agent": UA },
            signal,
            redirect: "manual",
          });
          if (!REDIRECT_STATUSES.has(res.status)) break;
          hops++;
          if (hops > MAX_REDIRECT_HOPS) return;
          const location = res.headers.get("location");
          if (!location) return;
          const next = new URL(location, current).href;
          if (shouldSkip(next)) return;
          current = next;
        }
        if (!res.ok) return;
        const info = parseMeta(decodeHtml(await res.arrayBuffer(), res.headers.get("content-type")));
        if (info.title || info.description) out[url] = info;
      } catch {
        /* timeout / network error — this link just has no info */
      }
    }),
  );
  return out;
}
