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
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByText("선택한 항목으로 뉴스레터 만들기"));
    expect(JSON.parse(localStorage.getItem("snl:selection")!)).toEqual(["삼성전자"]);
    expect(push).toHaveBeenCalledWith("/newsletter");
  });
});
