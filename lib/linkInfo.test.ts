import { describe, it, expect, vi } from "vitest";
import iconv from "iconv-lite";
import { shouldSkip, decodeHtml, parseMeta, fetchLinkInfo } from "./linkInfo";

const html = (head: string) => `<html><head>${head}</head><body></body></html>`;
const res = (body: string | Uint8Array, contentType = "text/html; charset=utf-8", status = 200) => {
  // Uint8Array.from copies, so a pooled Buffer never leaks extra bytes into .buffer
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : Uint8Array.from(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": contentType }),
    arrayBuffer: async () => bytes.buffer,
  } as unknown as Response;
};
const eucKr = (s: string) => Uint8Array.from(iconv.encode(s, "euc-kr")).buffer;
const redirectRes = (status: number, location?: string) =>
  ({
    ok: false,
    status,
    headers: new Headers(location ? { location } : {}),
    arrayBuffer: async () => new ArrayBuffer(0),
  }) as unknown as Response;

describe("shouldSkip", () => {
  it("skips data/SNS hosts, non-http, localhost and IP links", () => {
    expect(shouldSkip("https://finance.naver.com/item/main.naver?code=000250")).toBe(true);
    expect(shouldSkip("https://markets.hankyung.com/marketmap/kospi")).toBe(true);
    expect(shouldSkip("https://kr.investing.com/commodities/crude-oil")).toBe(true);
    expect(shouldSkip("https://truthsocial.com/@realDonaldTrump/posts/1")).toBe(true);
    expect(shouldSkip("ftp://example.com/a")).toBe(true);
    expect(shouldSkip("http://localhost:3000/")).toBe(true);
    expect(shouldSkip("http://127.0.0.1/")).toBe(true);
    expect(shouldSkip("http://[::1]/")).toBe(true);
    expect(shouldSkip("not a url")).toBe(true);
  });
  it("opens ordinary news links", () => {
    expect(shouldSkip("https://n.news.naver.com/mnews/article/374/0000502976")).toBe(false);
    expect(shouldSkip("https://www.insight.co.kr/news/549347")).toBe(false);
  });
  it("strips a trailing dot from the hostname before checking", () => {
    expect(shouldSkip("http://localhost./")).toBe(true);
    expect(shouldSkip("https://finance.naver.com./x")).toBe(true);
  });
});

describe("decodeHtml", () => {
  it("decodes EUC-KR when the header says so", () =>
    expect(decodeHtml(eucKr("<title>삼성전자</title>"), "text/html; charset=EUC-KR")).toContain("삼성전자"));
  it("decodes EUC-KR when only the meta tag says so", () =>
    expect(decodeHtml(eucKr('<meta charset="euc-kr"><title>삼성전자</title>'), "text/html")).toContain("삼성전자"));
  it("defaults to UTF-8", () =>
    expect(decodeHtml(new TextEncoder().encode("<title>휴전</title>").buffer as ArrayBuffer, null)).toContain("휴전"));
});

describe("parseMeta", () => {
  it("reads og:title and og:description, decoding entities", () =>
    expect(parseMeta(html(
      '<meta property="og:title" content="백악관 &quot;이스라엘도 임시 휴전 동의&quot;">' +
      '<meta property="og:description" content="휴전 소식에 유가 급락.">',
    ))).toEqual({ title: '백악관 "이스라엘도 임시 휴전 동의"', description: "휴전 소식에 유가 급락." }));
  it("falls back to <title> and omits a missing description", () =>
    expect(parseMeta(html("<title>코스피 마켓맵 | 한국경제</title>"))).toEqual({ title: "코스피 마켓맵 | 한국경제" }));
  it("returns {} when nothing is there", () => expect(parseMeta(html(""))).toEqual({}));
});

describe("fetchLinkInfo", () => {
  const insight = "https://www.insight.co.kr/news/549347";

  it("fetches non-skipped links once each and drops failures", async () => {
    const fake = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("insight")) {
        return res(html('<meta property="og:title" content="중국산 로봇"><meta property="og:description" content="미국이 차단 법안을 발의했다. 수혜 기대.">'));
      }
      if (u.includes("blocked")) return res("", "text/plain", 403);
      throw new Error("offline");
    });
    const out = await fetchLinkInfo(
      [insight, "https://blocked.example.com/a", "https://down.example.com/b", "https://finance.naver.com/sise/", insight],
      fake as unknown as typeof fetch,
    );
    expect(out).toEqual({ [insight]: { title: "중국산 로봇", description: "미국이 차단 법안을 발의했다. 수혜 기대." } });
    expect(fake).toHaveBeenCalledTimes(3);
  });

  it("passes a timeout signal to every request", async () => {
    const fake = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => res(html("<title>t</title>")));
    await fetchLinkInfo([insight], fake as unknown as typeof fetch);
    expect(fake.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("opens at most 30 links", async () => {
    const fake = vi.fn(async () => res(html("<title>t</title>")));
    const urls = Array.from({ length: 35 }, (_, i) => `https://news.example.com/${i}`);
    await fetchLinkInfo(urls, fake as unknown as typeof fetch);
    expect(fake).toHaveBeenCalledTimes(30);
  });

  it("stops following a redirect that leads into an internal address", async () => {
    const fake = vi.fn(async () => redirectRes(302, "http://127.0.0.1/admin"));
    const out = await fetchLinkInfo(["https://a.example.com/x"], fake as unknown as typeof fetch);
    expect(out).toEqual({});
    expect(fake).toHaveBeenCalledTimes(1);
  });

  it("follows a redirect and keys the result by the original url", async () => {
    const original = "https://a.example.com/x";
    const final = "https://news.example.com/final";
    const fake = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u === original) return redirectRes(301, final);
      if (u === final) return res(html('<meta property="og:title" content="속보">'));
      throw new Error("unexpected url " + u);
    });
    const out = await fetchLinkInfo([original], fake as unknown as typeof fetch);
    expect(out).toEqual({ [original]: { title: "속보" } });
    expect(fake).toHaveBeenCalledTimes(2);
    expect(String(fake.mock.calls[1][0])).toBe(final);
  });

  it("gives up after more than 3 redirect hops", async () => {
    const fake = vi.fn(async (url: string | URL | Request) => {
      const n = Number(String(url).split("/").pop());
      return redirectRes(302, `https://news.example.com/${n + 1}`);
    });
    const out = await fetchLinkInfo(["https://news.example.com/0"], fake as unknown as typeof fetch);
    expect(out).toEqual({});
  });

  it("passes redirect: manual on every hop", async () => {
    const original = "https://a.example.com/x";
    const final = "https://news.example.com/final";
    const fake = vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
      const u = String(url);
      if (u === original) return redirectRes(301, final);
      return res(html("<title>t</title>"));
    });
    await fetchLinkInfo([original], fake as unknown as typeof fetch);
    for (const call of fake.mock.calls) {
      expect((call[1] as RequestInit | undefined)?.redirect).toBe("manual");
    }
  });
});
