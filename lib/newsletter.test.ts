import { describe, it, expect } from "vitest";
import { buildNewsletter, brokerageLabel } from "./newsletter";
import type { RecItem, ResearchItem } from "./types";

const rec = (o: Partial<RecItem>): RecItem => ({
  stock: "삼성전자", mentionCount: 3, brokerages: ["삼성", "미래에셋", "NH"],
  items: [], leadComment: "3분기 실적 컨센 상회", leadBrokerage: "삼성",
  tags: [], isWatchlist: false, hidden: false, score: 0, ...o,
});

describe("brokerageLabel", () => {
  it("lists up to 3 then 외, N곳", () =>
    expect(brokerageLabel(["삼성", "미래에셋", "KB", "NH", "하나"])).toBe("삼성·미래에셋·KB 외, 5곳"));
  it("no 외 when 3 or fewer", () =>
    expect(brokerageLabel(["삼성", "NH"])).toBe("삼성·NH, 2곳"));
});

describe("buildNewsletter", () => {
  it("omits empty sections and renders the header/footer", () => {
    const out = buildNewsletter({ dateLabel: "2026년 9월 3일", company: [rec({ mentionCount: 3 })], market: [] });
    expect(out).toContain("📈 오늘의 증권가 브리핑 · 2026년 9월 3일");
    expect(out).toContain("[여러 증권사 주목]");
    expect(out).not.toContain("[목표가·투자의견 변경]");
    expect(out).toContain("• 삼성전자 — 3분기 실적 컨센 상회 (삼성·미래에셋·NH, 3곳)");
    expect(out.trimEnd().endsWith("※ 자료: 네이버 금융 리서치, 한경 컨센서스")).toBe(true);
  });

  it("strips a leading 종목명(코드) label from the lead comment", () => {
    const out = buildNewsletter({
      dateLabel: "d", market: [],
      company: [rec({ stock: "세경하이테크", leadComment: "세경하이테크(148150) 실적 반등 시작", mentionCount: 2 })],
    });
    expect(out).toContain("• 세경하이테크 — 실적 반등 시작 (");
    expect(out).not.toContain("(148150)");
  });

  it("routes a target-up rec to the 목표가 변경 section with pct", () => {
    const out = buildNewsletter({
      dateLabel: "d", market: [],
      company: [rec({ tags: ["target-up"], targetPriceChangePct: 12 })],
    });
    expect(out).toContain("[목표가·투자의견 변경]");
    expect(out).toContain("/ 목표가 +12%");
    expect(out).not.toContain("[여러 증권사 주목]");
  });

  it("renders market lines and 단톡방 fallback raw text", () => {
    const m: ResearchItem = {
      stock: "시황", title: "외국인 순매수 전환 전망", brokerage: "대신",
      date: "2026-09-03", sourceSite: "naver", sourceUrl: "u", kind: "market",
    };
    const out = buildNewsletter({ dateLabel: "d", company: [], market: [m], chatroomRaw: "장초반 반도체 강세" });
    expect(out).toContain("[시황]\n• 외국인 순매수 전환 전망 — 대신");
    expect(out).toContain("[단톡방 언급]\n• 장초반 반도체 강세");
  });
});
