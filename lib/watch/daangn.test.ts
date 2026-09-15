import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDaangnListings, fetchDaangnSearch } from "./daangn";

const fixture = readFileSync(join(__dirname, "fixtures", "daangn-search.html"), "utf8");

const okText = (text: string) => ({ ok: true, text: async () => text }) as unknown as Response;
const notOk = () => ({ ok: false, text: async () => "" }) as unknown as Response;

describe("parseDaangnListings", () => {
  it("extracts every listing from the embedded __remixContext blob", () => {
    const items = parseDaangnListings(fixture);
    expect(items).toHaveLength(6);

    const first = items[0];
    expect(first.id).toBe("aaaa1111bbbb");
    expect(first.title).toBe("샤오미 PM-10 전동킥보드 팝니다");
    expect(first.price).toBe(350000);
    expect(first.region).toBe("송도동");
    expect(first.status).toBe("Ongoing");
    expect(first.createdAt).toBe("2026-09-08T23:11:00.000Z");
    expect(first.url).toMatch(/^https:\/\/www\.daangn\.com\/kr\/buy-sell\/.+-aaaa1111bbbb\/$/);
  });

  it("represents a 나눔 (price '0') listing as price null", () => {
    const nanum = parseDaangnListings(fixture).find((i) => i.id === "eeee3333ffff");
    expect(nanum?.price).toBeNull();
  });

  it("keeps Reserved / Closed listings but tags their status", () => {
    const items = parseDaangnListings(fixture);
    expect(items.find((i) => i.id === "gggg4444hhhh")?.status).toBe("Reserved");
    expect(items.find((i) => i.id === "iiii5555jjjj")?.status).toBe("Closed");
  });

  it("returns [] when the blob is absent or unparseable", () => {
    expect(parseDaangnListings("<html><body>no data here</body></html>")).toEqual([]);
    expect(parseDaangnListings("window.__remixContext = {oops;</script>")).toEqual([]);
  });
});

describe("fetchDaangnSearch (fake fetchImpl)", () => {
  it("requests the region + keyword search URL and returns parsed listings", async () => {
    let calledUrl = "";
    const fake = (async (url: string | URL | Request) => {
      calledUrl = String(url);
      return okText(fixture);
    }) as unknown as typeof fetch;

    const items = await fetchDaangnSearch("PM-10", { regionSlug: "송도동-6543" }, fake);

    expect(calledUrl).toContain("/kr/buy-sell/s/");
    expect(calledUrl).toContain("in=%EC%86%A1%EB%8F%84%EB%8F%99-6543");
    expect(calledUrl).toContain("search=PM-10");
    expect(items).toHaveLength(6);
  });

  it("returns null when the response is not ok", async () => {
    const fake = (async () => notOk()) as unknown as typeof fetch;
    expect(await fetchDaangnSearch("PM-10", { regionSlug: "송도동-6543" }, fake)).toBeNull();
  });

  it("returns null (never rejects) when fetchImpl throws", async () => {
    const fake = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await expect(
      fetchDaangnSearch("PM-10", { regionSlug: "송도동-6543" }, fake),
    ).resolves.toBeNull();
  });

  it("returns [] (not null) when 당근 is reached but has no results", async () => {
    const emptyPage =
      '<script>window.__remixContext = {"state":{"loaderData":{"routes/kr.buy-sell.s":{"allPage":{"fleamarketArticles":[]}}}}};</script>';
    const fake = (async () => okText(emptyPage)) as unknown as typeof fetch;
    expect(await fetchDaangnSearch("PM-10", { regionSlug: "송도동-6543" }, fake)).toEqual([]);
  });
});
