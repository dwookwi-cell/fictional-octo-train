import { describe, it, expect } from "vitest";
import { isRecentKST, parseLooseKoreanDate, formatKoreanDate } from "./dates";

const NOW = new Date("2026-09-03T00:30:00Z"); // 2026-09-03 09:30 KST

describe("isRecentKST", () => {
  it("accepts today (KST)", () => expect(isRecentKST("2026-09-03", NOW)).toBe(true));
  it("accepts yesterday (KST)", () => expect(isRecentKST("2026-09-02", NOW)).toBe(true));
  it("rejects two days ago", () => expect(isRecentKST("2026-09-01", NOW)).toBe(false));
  it("rejects the future", () => expect(isRecentKST("2026-09-04", NOW)).toBe(false));
});

describe("parseLooseKoreanDate", () => {
  it("parses YY.MM.DD", () => expect(parseLooseKoreanDate("26.09.02", NOW)).toBe("2026-09-02"));
  it("parses YYYY.MM.DD", () => expect(parseLooseKoreanDate("2026.09.02", NOW)).toBe("2026-09-02"));
  it("parses YYYY-MM-DD", () => expect(parseLooseKoreanDate("2026-09-02", NOW)).toBe("2026-09-02"));
  it("returns null on garbage", () => expect(parseLooseKoreanDate("어제", NOW)).toBeNull());
});

describe("formatKoreanDate", () => {
  it("formats KST date", () => expect(formatKoreanDate(NOW)).toBe("2026년 9월 3일"));
});
