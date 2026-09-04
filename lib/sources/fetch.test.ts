import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import iconv from "iconv-lite";
import { fetchNaverResearch } from "./naver";
import { fetchHankyungConsensus } from "./hankyung";

const fxUtf8 = (n: string) => readFileSync(join(__dirname, "fixtures", n), "utf8");
// Live Naver serves EUC-KR; the committed fixture is UTF-8, so re-encode to
// EUC-KR bytes to exercise fetchNaverResearch's TextDecoder("euc-kr") path.
const fxEucKr = (n: string) => iconv.encode(fxUtf8(n), "euc-kr");

const okArrayBuffer = (bytes: Uint8Array) =>
  ({ ok: true, arrayBuffer: async () => bytes }) as unknown as Response;
const okText = (text: string) =>
  ({ ok: true, text: async () => text }) as unknown as Response;
const notOk = () =>
  ({
    ok: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    text: async () => "",
  }) as unknown as Response;

describe("fetchNaverResearch (fake fetchImpl)", () => {
  it("happy path: routes each list URL to its fixture and decodes EUC-KR correctly", async () => {
    const fake = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("company_list")) return okArrayBuffer(fxEucKr("naver-company.html"));
      if (u.includes("industry_list")) return okArrayBuffer(fxEucKr("naver-industry.html"));
      if (u.includes("market_info_list")) return okArrayBuffer(fxEucKr("naver-market.html"));
      throw new Error(`unexpected url: ${u}`);
    }) as unknown as typeof fetch;

    const items = await fetchNaverResearch(fake);

    expect(items.length).toBeGreaterThan(10);
    // Hangul survived the EUC-KR decode (not mojibake).
    expect(items[0].stock).toBe("비츠로셀");
    expect(items[0].brokerage).toBe("신한");
    expect(items.some((i) => i.kind === "company")).toBe(true);
    expect(items.some((i) => i.kind === "industry")).toBe(true);
    expect(items.some((i) => i.kind === "market")).toBe(true);
  });

  it("returns [] when the response is not ok", async () => {
    const fake = (async () => notOk()) as unknown as typeof fetch;
    expect(await fetchNaverResearch(fake)).toEqual([]);
  });

  it("returns [] (never rejects) when fetchImpl throws", async () => {
    const fake = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await expect(fetchNaverResearch(fake)).resolves.toEqual([]);
  });
});

describe("fetchHankyungConsensus (fake fetchImpl)", () => {
  it("happy path: parses the UTF-8 fixture text into a non-empty ResearchItem[]", async () => {
    const fake = (async () => okText(fxUtf8("hankyung.html"))) as unknown as typeof fetch;

    const items = await fetchHankyungConsensus(fake);

    expect(items.length).toBeGreaterThan(5);
    expect(items[0].title).toContain("세경하이테크");
    expect(items[0].brokerage).toBe("메리츠");
    expect(items[0].date).toBe("2026-09-04");
    expect(items[0].sourceSite).toBe("hankyung");
  });

  it("returns [] when the response is not ok", async () => {
    const fake = (async () => notOk()) as unknown as typeof fetch;
    expect(await fetchHankyungConsensus(fake)).toEqual([]);
  });

  it("returns [] (never rejects) when fetchImpl throws", async () => {
    const fake = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await expect(fetchHankyungConsensus(fake)).resolves.toEqual([]);
  });
});
