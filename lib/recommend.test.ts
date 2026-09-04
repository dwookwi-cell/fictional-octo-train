import { describe, it, expect } from "vitest";
import { recommend } from "./recommend";
import type { ResearchItem } from "./types";

const mk = (o: Partial<ResearchItem>): ResearchItem => ({
  stock: "삼성전자", title: "3분기 실적 리뷰", brokerage: "삼성",
  date: "2026-09-03", sourceSite: "naver", sourceUrl: "u", kind: "company", ...o,
});

describe("recommend", () => {
  it("includes a stock mentioned by >=2 distinct brokerages, not hidden", () => {
    const out = recommend({
      items: [mk({ brokerage: "삼성" }), mk({ brokerage: "미래에셋" }), mk({ brokerage: "KB" })],
      watchlist: [], chatroomStocks: [],
    });
    expect(out.company).toHaveLength(1);
    expect(out.company[0].mentionCount).toBe(3);
    expect(out.company[0].hidden).toBe(false);
    expect(out.company[0].score).toBe(30); // 0 + 3*10 + 0 + 0
  });

  it("hides a single-brokerage stock with no special tags", () => {
    const out = recommend({ items: [mk({ brokerage: "삼성" })], watchlist: [], chatroomStocks: [] });
    expect(out.company[0].hidden).toBe(true);
  });

  it("puts a watchlist stock first, never hidden, with the tag", () => {
    const out = recommend({
      items: [
        mk({ stock: "한화에어로스페이스", brokerage: "삼성" }),
        mk({ stock: "삼성전자", brokerage: "삼성" }),
        mk({ stock: "삼성전자", brokerage: "NH" }),
      ],
      watchlist: ["한화에어로스페이스"], chatroomStocks: [],
    });
    expect(out.company[0].stock).toBe("한화에어로스페이스");
    expect(out.company[0].hidden).toBe(false);
    expect(out.company[0].tags).toContain("watchlist");
  });

  it("tags target-up from a title keyword and picks it as lead comment", () => {
    const out = recommend({
      items: [mk({ brokerage: "삼성", title: "메모리 업턴, 목표가 상향" }), mk({ brokerage: "NH", title: "3분기 프리뷰" })],
      watchlist: [], chatroomStocks: [],
    });
    expect(out.company[0].tags).toContain("target-up");
    expect(out.company[0].leadComment).toBe("메모리 업턴, 목표가 상향");
  });

  it("computes targetPriceChangePct from prevTargetPrices", () => {
    const out = recommend({
      items: [mk({ brokerage: "삼성", targetPrice: 110000 }), mk({ brokerage: "NH" })],
      watchlist: [], chatroomStocks: [], prevTargetPrices: { 삼성전자: 100000 },
    });
    expect(out.company[0].targetPriceChangePct).toBe(10);
  });

  it("computes targetPriceChangePct from the newest item's targetPrice", () => {
    const out = recommend({
      items: [
        mk({ brokerage: "삼성", date: "2026-09-01", targetPrice: 110000 }),
        mk({ brokerage: "NH", date: "2026-09-03", targetPrice: 120000 }),
      ],
      watchlist: [], chatroomStocks: [], prevTargetPrices: { 삼성전자: 100000 },
    });
    expect(out.company[0].targetPriceChangePct).toBe(20); // from newest (120000), not oldest (110000)
  });

  it("tags target-down from a 하향 title", () => {
    const out = recommend({
      items: [mk({ brokerage: "삼성", title: "실적 부진, 목표가 하향" }), mk({ brokerage: "NH", title: "3분기 프리뷰" })],
      watchlist: [], chatroomStocks: [],
    });
    expect(out.company[0].tags).toContain("target-down");
  });

  it("tags new-coverage from an Initiate title", () => {
    const out = recommend({
      items: [mk({ stock: "에코프로", brokerage: "삼성", title: "Initiate at Buy" })],
      watchlist: [], chatroomStocks: [],
    });
    expect(out.company[0].tags).toContain("new-coverage");
  });

  it("tags chatroom and keeps the item visible even with one brokerage", () => {
    const out = recommend({
      items: [mk({ stock: "에코프로", brokerage: "삼성" })],
      watchlist: [], chatroomStocks: ["에코프로"],
    });
    expect(out.company[0].tags).toContain("chatroom");
    expect(out.company[0].hidden).toBe(false);
  });

  it("separates industry and market items", () => {
    const out = recommend({
      items: [
        mk({ kind: "industry", stock: "반도체", brokerage: "삼성" }),
        mk({ kind: "market", title: "외국인 수급 점검", brokerage: "대신" }),
      ],
      watchlist: [], chatroomStocks: [],
    });
    expect(out.industry).toHaveLength(1);
    expect(out.market).toHaveLength(1);
    expect(out.company).toHaveLength(0);
  });
});
