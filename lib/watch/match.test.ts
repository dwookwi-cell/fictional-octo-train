import { describe, it, expect } from "vitest";
import { normalizeForMatch, matchesAnyKeyword } from "./match";

describe("normalizeForMatch", () => {
  it("lowercases and strips spaces, hyphens, underscores", () => {
    expect(normalizeForMatch("PM-10")).toBe("pm10");
    expect(normalizeForMatch("  pm 10  ")).toBe("pm10");
    expect(normalizeForMatch("PM_10")).toBe("pm10");
  });

  it("keeps Hangul and other characters intact", () => {
    expect(normalizeForMatch("샤오미 PM-10 킥보드")).toBe("샤오미pm10킥보드");
  });
});

describe("matchesAnyKeyword", () => {
  const keywords = ["PM-10", "PM10"];

  it("matches when a normalized keyword appears in the normalized title", () => {
    expect(matchesAnyKeyword("샤오미 PM-10 전동킥보드 판매", keywords)).toBe(true);
    expect(matchesAnyKeyword("나인봇 pm 10 상태 좋음", keywords)).toBe(true);
  });

  it("does not match unrelated titles", () => {
    expect(matchesAnyKeyword("맥북 프로 M1 13인치", keywords)).toBe(false);
  });

  it("returns false when there are no usable keywords", () => {
    expect(matchesAnyKeyword("샤오미 PM-10", [])).toBe(false);
    expect(matchesAnyKeyword("샤오미 PM-10", ["-", "  "])).toBe(false);
  });
});
