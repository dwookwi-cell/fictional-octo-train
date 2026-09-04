// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CollectionResult } from "@/lib/types";

vi.mock("next/navigation", () => ({ usePathname: () => "/newsletter" }));

const collection: CollectionResult = {
  collectedAt: new Date().toISOString(),
  failures: [],
  items: [
    { stock: "삼성전자", title: "목표가 상향", brokerage: "삼성", date: "2026-09-03", sourceSite: "naver", sourceUrl: "u1", kind: "company" },
    { stock: "삼성전자", title: "3분기 프리뷰", brokerage: "NH", date: "2026-09-03", sourceSite: "naver", sourceUrl: "u2", kind: "company" },
  ],
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("snl:collection", JSON.stringify(collection));
  localStorage.setItem("snl:selection", JSON.stringify(["삼성전자"]));
  localStorage.setItem("snl:marketSelection", JSON.stringify([]));
});

import Page from "./page";

describe("뉴스레터 screen", () => {
  it("builds the draft from the saved selection", async () => {
    render(<Page />);
    const ta = (await screen.findByRole("textbox")) as HTMLTextAreaElement;
    expect(ta.value).toContain("📈 오늘의 증권가 브리핑");
    expect(ta.value).toContain("• 삼성전자 — 목표가 상향");
  });

  it("rebuilds from the selection when no draft is stored", async () => {
    // a real selection is seeded in beforeEach; snl:draft is absent
    render(<Page />);
    const ta = (await screen.findByRole("textbox")) as HTMLTextAreaElement;
    expect(ta.value).toContain("• 삼성전자 — 목표가 상향");
  });

  it("restores a saved draft on direct (back-nav) entry", async () => {
    localStorage.setItem("snl:draft", JSON.stringify("이전에 수정하던 초안"));
    render(<Page />);
    const ta = (await screen.findByRole("textbox")) as HTMLTextAreaElement;
    expect(ta.value).toBe("이전에 수정하던 초안");
  });

  it("copies via clipboard on 전체 복사", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<Page />);
    await screen.findByRole("textbox");
    await userEvent.click(screen.getByText("전체 복사"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("오늘의 증권가 브리핑"));
  });

  it("uses navigator.share on 카톡으로 보내기 when available", async () => {
    const share = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, share });
    render(<Page />);
    await screen.findByRole("textbox");
    await userEvent.click(screen.getByText("카톡으로 보내기"));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining("증권가 브리핑") }));
  });

  it("does not dump the chat transcript when a mentioned stock is already in recs", async () => {
    localStorage.setItem(
      "snl:chatroom",
      JSON.stringify({ matched: ["삼성전자"], raw: "삼성전자 오늘 왜 이럼 ㅋㅋ 아무말 대잔치 전체 로그" }),
    );
    render(<Page />);
    const ta = (await screen.findByRole("textbox")) as HTMLTextAreaElement;
    expect(ta.value).not.toContain("[단톡방 언급]");
    expect(ta.value).not.toContain("아무말 대잔치");
  });

  it("falls back to full copy when share fails with a non-abort error", async () => {
    const writeText = vi.fn(async () => {});
    const share = vi.fn(async () => { throw new Error("boom"); });
    vi.stubGlobal("navigator", { ...navigator, share, clipboard: { writeText } });
    render(<Page />);
    await screen.findByRole("textbox");
    await userEvent.click(screen.getByText("카톡으로 보내기"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("증권가 브리핑"));
    expect(screen.getByText(/공유에 실패해 전체 복사했습니다/)).toBeInTheDocument();
  });

  it("persists edits to the draft", async () => {
    render(<Page />);
    const ta = await screen.findByRole("textbox");
    await userEvent.type(ta, " 추가메모");
    expect(localStorage.getItem("snl:draft")).toContain("추가메모");
  });
});
