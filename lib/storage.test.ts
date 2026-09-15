// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  getWatchlist, setWatchlist, saveSnapshot, loadPrevTargetPrices,
  saveSelection, loadSelection, saveDraft, loadDraft,
  saveChatroom, loadChatroom,
  saveMemoPaste, loadMemoPaste, saveMemoDraft, loadMemoDraft,
} from "./storage";
import type { ResearchItem } from "./types";

const mk = (o: Partial<ResearchItem>): ResearchItem => ({
  stock: "삼성전자", title: "t", brokerage: "삼성", date: "2026-09-03",
  sourceSite: "naver", sourceUrl: "u", kind: "company", ...o,
});

beforeEach(() => localStorage.clear());

describe("watchlist", () => {
  it("round-trips, trimming and de-duping", () => {
    setWatchlist([" 삼성전자 ", "삼성전자", "", "SK하이닉스"]);
    expect(getWatchlist()).toEqual(["삼성전자", "SK하이닉스"]);
  });
  it("defaults to [] when unset", () => expect(getWatchlist()).toEqual([]));
});

describe("snapshots", () => {
  it("returns target prices from the newest snapshot before a date", () => {
    saveSnapshot("2026-09-01", [mk({ targetPrice: 90000 })]);
    saveSnapshot("2026-09-02", [mk({ targetPrice: 100000 })]);
    expect(loadPrevTargetPrices("2026-09-03")).toEqual({ 삼성전자: 100000 });
    expect(loadPrevTargetPrices("2026-09-02")).toEqual({ 삼성전자: 90000 });
  });
  it("prunes snapshots older than 14 days", () => {
    saveSnapshot("2026-08-01", [mk({ targetPrice: 1 })]);
    saveSnapshot("2026-09-03", [mk({ targetPrice: 2 })]);
    expect(localStorage.getItem("snl:snapshot:2026-08-01")).toBeNull();
  });
});

describe("selection & draft", () => {
  it("round-trips selection", () => { saveSelection(["삼성전자"]); expect(loadSelection()).toEqual(["삼성전자"]); });
  it("round-trips draft", () => { saveDraft("hello"); expect(loadDraft()).toBe("hello"); });
});

describe("chatroom", () => {
  it("round-trips", () => {
    saveChatroom({ matched: ["에코프로"], raw: "text" });
    expect(loadChatroom()).toEqual({ matched: ["에코프로"], raw: "text" });
  });
});

describe("끄적임", () => {
  it("round-trips paste and draft, defaulting to empty", () => {
    expect(loadMemoPaste()).toBe("");
    expect(loadMemoDraft()).toBe("");
    saveMemoPaste("#장 코스피");
    saveMemoDraft("오늘의 끄적임");
    expect(loadMemoPaste()).toBe("#장 코스피");
    expect(loadMemoDraft()).toBe("오늘의 끄적임");
  });
});
