// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CollectionResult } from "@/lib/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/" }));

const collection: CollectionResult = {
  collectedAt: new Date().toISOString(),
  failures: [],
  items: [
    { stock: "삼성전자", title: "목표가 상향", brokerage: "삼성", date: "2026-09-03", sourceSite: "naver", sourceUrl: "u1", kind: "company" },
    { stock: "삼성전자", title: "3분기 프리뷰", brokerage: "NH", date: "2026-09-03", sourceSite: "naver", sourceUrl: "u2", kind: "company" },
    { stock: "동화기업", title: "리포트", brokerage: "키움", date: "2026-09-03", sourceSite: "naver", sourceUrl: "u3", kind: "company" },
    { stock: "2차전지", title: "업황 개선", brokerage: "하나", date: "2026-09-03", sourceSite: "naver", sourceUrl: "u4", kind: "industry" },
  ],
};

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => collection })) as unknown as typeof fetch);
});

import Page from "./page";

describe("추천 screen", () => {
  it("auto-collects on mount and shows a >=2-brokerage rec, hiding the single one", async () => {
    render(<Page />);
    expect(await screen.findByText("삼성전자")).toBeInTheDocument();
    expect(screen.queryByText("동화기업")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("전체 보기"));
    expect(screen.getByText("동화기업")).toBeInTheDocument();
  });

  it("includes pasted chat-room stocks in analysis", async () => {
    render(<Page />);
    await screen.findByText("삼성전자");
    await userEvent.type(screen.getByPlaceholderText(/카톡방/), "동화기업 오늘 좋네요");
    await userEvent.click(screen.getByText("분석에 포함"));
    await waitFor(() => expect(screen.getByText("단톡방 언급")).toBeInTheDocument());
  });

  it("saves selection and navigates to /newsletter", async () => {
    render(<Page />);
    await screen.findByText("삼성전자");
    await userEvent.click(screen.getAllByRole("checkbox")[0]);
    await userEvent.click(screen.getByText("선택한 항목으로 뉴스레터 만들기"));
    expect(JSON.parse(localStorage.getItem("snl:selection")!)).toEqual(["삼성전자"]);
    expect(push).toHaveBeenCalledWith("/newsletter");
  });

  it("clears a stale draft so the newsletter rebuilds from the new selection", async () => {
    localStorage.setItem("snl:draft", JSON.stringify("어제 만든 초안"));
    render(<Page />);
    await screen.findByText("삼성전자");
    await userEvent.click(screen.getAllByRole("checkbox")[0]);
    await userEvent.click(screen.getByText("선택한 항목으로 뉴스레터 만들기"));
    expect(localStorage.getItem("snl:draft")).toBeNull();
  });

  it("keeps ticked 시황 URLs out of snl:selection", async () => {
    const withMarket: CollectionResult = {
      collectedAt: new Date().toISOString(),
      failures: [],
      items: [
        ...collection.items,
        { stock: "코스피", title: "장 마감 시황", brokerage: "한경", date: "2026-09-03", sourceSite: "hankyung", sourceUrl: "m1", kind: "market" },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => withMarket })) as unknown as typeof fetch);
    render(<Page />);
    await screen.findByText("삼성전자");
    const boxes = screen.getAllByRole("checkbox");
    await userEvent.click(boxes[0]); // 삼성전자 (company)
    await userEvent.click(boxes[boxes.length - 1]); // 장 마감 시황 (market, sourceUrl m1)
    await userEvent.click(screen.getByText("선택한 항목으로 뉴스레터 만들기"));
    expect(JSON.parse(localStorage.getItem("snl:selection")!)).toEqual(["삼성전자"]);
    expect(JSON.parse(localStorage.getItem("snl:marketSelection")!)).toEqual(["m1"]);
  });

  it("renders a read-only 산업 section listing industry items", async () => {
    render(<Page />);
    await screen.findByText("삼성전자");
    expect(screen.getByRole("heading", { name: "산업" })).toBeInTheDocument();
    expect(screen.getByText(/2차전지 · 하나/)).toBeInTheDocument();
  });

  it("shows a failure notice when collect returns not-ok, with no rec list", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })) as unknown as typeof fetch);
    render(<Page />);
    expect(await screen.findByText(/수집에 실패했습니다/)).toBeInTheDocument();
  });

  it("shows a failure notice when fetch rejects, without an unhandled rejection", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }) as unknown as typeof fetch);
    render(<Page />);
    expect(await screen.findByText(/수집에 실패했습니다/)).toBeInTheDocument();
  });

  it("shows a retry notice (not the no-overlap message) when both sources fail", async () => {
    const bothFailed: CollectionResult = {
      collectedAt: new Date().toISOString(), items: [], failures: ["naver", "hankyung"],
    };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => bothFailed })) as unknown as typeof fetch);
    render(<Page />);
    expect(await screen.findByText(/수집에 실패했습니다/)).toBeInTheDocument();
    expect(screen.queryByText(/겹친 종목이 없습니다/)).not.toBeInTheDocument();
    expect(screen.getByText(/네이버 수집 실패/)).toBeInTheDocument();
  });

  it("shows the last-collected time", async () => {
    render(<Page />);
    await screen.findByText("삼성전자");
    expect(screen.getByText(/마지막 수집: \d{2}:\d{2}/)).toBeInTheDocument();
  });
});
