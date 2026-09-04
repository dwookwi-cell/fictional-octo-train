import { describe, it, expect } from "vitest";
import { normalizeStock, normalizeBrokerage, dedupeItems } from "./normalize";
import type { ResearchItem } from "./types";

describe("normalizeStock", () => {
  it("trims and collapses spaces", () => expect(normalizeStock("  삼성 전자 ")).toBe("삼성전자"));
  it("drops trailing ticker in parens", () => expect(normalizeStock("삼성전자(005930)")).toBe("삼성전자"));
});

describe("normalizeBrokerage", () => {
  it("standardizes known aliases", () => {
    expect(normalizeBrokerage("미래에셋증권")).toBe("미래에셋");
    expect(normalizeBrokerage("삼성증권")).toBe("삼성");
    expect(normalizeBrokerage("KB증권")).toBe("KB");
  });
  it("passes through unknown names trimmed", () => expect(normalizeBrokerage(" 웰스 ")).toBe("웰스"));
});

describe("dedupeItems", () => {
  const base: ResearchItem = {
    stock: "삼성전자", title: "3분기 실적 컨센 상회", brokerage: "삼성",
    date: "2026-09-03", sourceSite: "naver", sourceUrl: "u1", kind: "company",
  };
  it("merges same stock+brokerage+similar title, keeps both urls separately", () => {
    const out = dedupeItems([
      base,
      { ...base, title: "3분기 실적 컨센 상회 (목표가 상향)", sourceSite: "hankyung", sourceUrl: "u2", targetPrice: 90000 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].targetPrice).toBe(90000);
    expect(out[0].sourceUrl).toBe("u1");
    expect(out[0].extraUrls).toEqual(["u2"]);
  });
  it("keeps different brokerages separate", () => {
    const out = dedupeItems([base, { ...base, brokerage: "미래에셋", sourceUrl: "u3" }]);
    expect(out).toHaveLength(2);
  });
});
