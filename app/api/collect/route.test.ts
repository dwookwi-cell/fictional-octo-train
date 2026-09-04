import { describe, it, expect } from "vitest";
import { collect } from "@/lib/collect";
import type { ResearchItem } from "@/lib/types";

const NOW = new Date("2026-09-03T00:00:00Z"); // 09:00 KST
const mk = (o: Partial<ResearchItem>): ResearchItem => ({
  stock: "삼성전자", title: "t", brokerage: "삼성", date: "2026-09-03",
  sourceSite: "naver", sourceUrl: "u", kind: "company", ...o,
});

describe("collect", () => {
  it("merges sources, dedupes, and drops stale items", async () => {
    const r = await collect({
      now: NOW,
      naver: async () => [mk({}), mk({ date: "2026-08-01", sourceUrl: "old" })],
      hankyung: async () => [mk({ sourceSite: "hankyung", sourceUrl: "u2", targetPrice: 90000 })],
    });
    expect(r.items).toHaveLength(1);
    expect(r.items[0].targetPrice).toBe(90000);
    expect(r.failures).toEqual([]);
  });

  it("records a source that throws as a failure but still returns the other", async () => {
    const r = await collect({
      now: NOW,
      naver: async () => { throw new Error("boom"); },
      hankyung: async () => [mk({ sourceSite: "hankyung" })],
    });
    expect(r.failures).toEqual(["naver"]);
    expect(r.items).toHaveLength(1);
  });

  it("records an empty source as a failure", async () => {
    const r = await collect({ now: NOW, naver: async () => [], hankyung: async () => [] });
    expect(r.failures.sort()).toEqual(["hankyung", "naver"]);
    expect(r.items).toEqual([]);
  });
});
