import { describe, it, expect } from "vitest";
import { selectMatches, formatListing } from "./run";
import type { DaangnListing } from "./daangn";

const make = (o: Partial<DaangnListing> & { id: string }): DaangnListing => ({
  title: "샤오미 PM-10 킥보드",
  price: 300000,
  region: "송도동",
  url: `https://www.daangn.com/kr/buy-sell/x-${o.id}/`,
  createdAt: "2026-09-08T00:00:00.000Z",
  status: "Ongoing",
  ...o,
});

describe("selectMatches", () => {
  const keywords = ["PM-10", "PM10"];

  it("keeps keyword hits, drops non-matches, and de-dupes by id", () => {
    const out = selectMatches(
      [
        make({ id: "a", title: "샤오미 PM-10 팝니다" }),
        make({ id: "a", title: "샤오미 PM-10 팝니다" }), // dup id from a second keyword fetch
        make({ id: "b", title: "맥북 프로 M1" }), // no keyword
      ],
      keywords,
      { ongoingOnly: false },
    );
    expect(out.map((l) => l.id)).toEqual(["a"]);
  });

  it("drops non-Ongoing listings when ongoingOnly is set", () => {
    const out = selectMatches(
      [
        make({ id: "a", status: "Ongoing" }),
        make({ id: "b", status: "Reserved" }),
        make({ id: "c", status: "Closed" }),
      ],
      keywords,
      { ongoingOnly: true },
    );
    expect(out.map((l) => l.id)).toEqual(["a"]);
  });

  it("sorts newest first by createdAt", () => {
    const out = selectMatches(
      [
        make({ id: "old", createdAt: "2026-09-01T00:00:00.000Z" }),
        make({ id: "new", createdAt: "2026-09-09T00:00:00.000Z" }),
        make({ id: "mid", createdAt: "2026-09-05T00:00:00.000Z" }),
      ],
      keywords,
      { ongoingOnly: false },
    );
    expect(out.map((l) => l.id)).toEqual(["new", "mid", "old"]);
  });
});

describe("formatListing", () => {
  it("renders price, title, region and link on one line", () => {
    const line = formatListing(
      make({ id: "a", title: "샤오미 PM-10 킥보드", price: 350000, region: "송도동" }),
    );
    expect(line).toBe(
      "350,000원 · 샤오미 PM-10 킥보드 · 송도동 · https://www.daangn.com/kr/buy-sell/x-a/",
    );
  });

  it("shows 나눔/제안 when price is null", () => {
    expect(formatListing(make({ id: "a", price: null }))).toContain("나눔/제안 · ");
  });

  it("prefixes a Korean status tag for non-Ongoing listings", () => {
    expect(formatListing(make({ id: "a", status: "Reserved" }))).toMatch(/^\[예약중\] /);
    expect(formatListing(make({ id: "a", status: "Closed" }))).toMatch(/^\[거래완료\] /);
  });
});
