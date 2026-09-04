import { describe, it, expect } from "vitest";
import { parseChatroom } from "./kakaoParse";

describe("parseChatroom", () => {
  it("finds base-dictionary stocks mentioned in free text", () => {
    const r = parseChatroom("오늘 삼성전자랑 SK하이닉스 강하네요. 엔비디아 실적도 체크");
    expect(r.matchedStocks).toEqual(["삼성전자", "SK하이닉스", "엔비디아"]);
  });

  it("uses the extra dictionary (today's collected names + watchlist)", () => {
    const r = parseChatroom("제노스코 관련 코멘트 나왔어요", ["제노스코"]);
    expect(r.matchedStocks).toEqual(["제노스코"]);
  });

  it("de-duplicates and preserves first-seen order", () => {
    const r = parseChatroom("카카오 카카오 NAVER");
    expect(r.matchedStocks).toEqual(["카카오", "NAVER"]);
  });

  it("returns trimmed rawText and empty matches when nothing matches", () => {
    const r = parseChatroom("  특별한 종목 언급 없음  ");
    expect(r.matchedStocks).toEqual([]);
    expect(r.rawText).toBe("특별한 종목 언급 없음");
  });
});
