import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseNaverList } from "./naver";

const fx = (n: string) => readFileSync(join(__dirname, "fixtures", n), "utf8");

describe("parseNaverList - company", () => {
  const items = parseNaverList(fx("naver-company.html"), "company");
  it("returns a non-trivial number of rows", () => expect(items.length).toBeGreaterThan(10));
  it("parses the first row fields", () => {
    expect(items[0].stock).toBe("비츠로셀");
    expect(items[0].title).toContain("Never Stop Rising");
    expect(items[0].brokerage).toBe("신한"); // normalized (e.g. "삼성")
    expect(items[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(items[0].kind).toBe("company");
    expect(items[0].sourceSite).toBe("naver");
    expect(items[0].sourceUrl).toMatch(/^https:\/\/finance\.naver\.com\/research\//);
  });
  it("every item has stock, title, brokerage, date", () => {
    for (const it of items) {
      expect(it.stock).not.toBe("");
      expect(it.title).not.toBe("");
      expect(it.brokerage).not.toBe("");
      expect(it.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("parseNaverList - industry & market", () => {
  it("industry rows have kind=industry", () => {
    const items = parseNaverList(fx("naver-industry.html"), "industry");
    expect(items.length).toBeGreaterThan(5);
    expect(items.every((i) => i.kind === "industry")).toBe(true);
  });
  it("market rows have kind=market and a brokerage", () => {
    const items = parseNaverList(fx("naver-market.html"), "market");
    expect(items.length).toBeGreaterThan(3);
    expect(items.every((i) => i.kind === "market" && i.brokerage !== "")).toBe(true);
  });
});
