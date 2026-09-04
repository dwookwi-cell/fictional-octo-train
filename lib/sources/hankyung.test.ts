import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseHankyungList } from "./hankyung";

const html = readFileSync(join(__dirname, "fixtures", "hankyung.html"), "utf8");
const businessHtml = readFileSync(join(__dirname, "fixtures", "hankyung-business.html"), "utf8");

describe("parseHankyungList", () => {
  const items = parseHankyungList(html);

  it("returns rows", () => expect(items.length).toBeGreaterThan(5));

  it("first row core fields", () => {
    // fixture row 0: 2026-09-04 | 기업 | 세경하이테크(148150) 실적 반등 시작, 모멘텀도 대기 중 | 양승수 | 메리츠증권
    expect(items[0].title).toContain("세경하이테크");
    expect(items[0].brokerage).toBe("메리츠"); // normalizeBrokerage("메리츠증권")
    expect(items[0].date).toBe("2026-09-04");
    expect(items[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(items[0].sourceSite).toBe("hankyung");
    expect(items[0].kind).toBe("company");
    expect(["company", "industry", "market"]).toContain(items[0].kind);
  });

  it("second row core fields", () => {
    // fixture row 1: 2026-09-04 | 기업 | 팬오션(028670) High & Dry | 이지니 | 대신증권
    expect(items[1].title).toContain("팬오션");
    expect(items[1].brokerage).toBe("대신"); // normalizeBrokerage("대신증권")
    expect(items[1].kind).toBe("company");
  });

  it("classifies all three kinds from the 분류 column", () => {
    const kinds = new Set(items.map((i) => i.kind));
    expect(kinds.has("company")).toBe(true);
    expect(kinds.has("industry")).toBe(true);
    expect(kinds.has("market")).toBe(true);
  });

  it("parses 적정가격/투자의견 from the 기업(business) view", () => {
    const biz = parseHankyungList(businessHtml);
    expect(biz.length).toBeGreaterThan(3);
    expect(biz.every((i) => i.kind === "company")).toBe(true);
    expect(biz.some((i) => typeof i.targetPrice === "number")).toBe(true);
    // fixture row: 세경하이테크(148150) … | 6,500 | Buy | 메리츠증권
    const row = biz.find((i) => i.stock === "세경하이테크");
    expect(row?.targetPrice).toBe(6500);
    expect(row?.opinion).toBe("Buy");
    expect(row?.brokerage).toBe("메리츠");
  });

  it("builds absolute sourceUrl on consensus.hankyung.com", () => {
    for (const it of items) {
      expect(it.sourceUrl).toMatch(/^https:\/\/consensus\.hankyung\.com\//);
    }
  });

  it("every item has title, brokerage, date", () => {
    for (const it of items) {
      expect(it.title).not.toBe("");
      expect(it.brokerage).not.toBe("");
      expect(it.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(it.sourceSite).toBe("hankyung");
    }
  });
});
