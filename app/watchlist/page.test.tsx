// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Page from "./page";
import { getWatchlist, setWatchlist } from "@/lib/storage";

beforeEach(() => localStorage.clear());

describe("watchlist page", () => {
  it("adds a stock and persists it", async () => {
    render(<Page />);
    await userEvent.type(screen.getByPlaceholderText("종목명 입력"), "삼성전자");
    await userEvent.click(screen.getByText("추가"));
    expect(screen.getByText("삼성전자")).toBeInTheDocument();
    expect(getWatchlist()).toEqual(["삼성전자"]);
  });

  it("loads existing watchlist on mount and deletes a row", async () => {
    setWatchlist(["삼성전자", "SK하이닉스"]);
    render(<Page />);
    expect(await screen.findByText("SK하이닉스")).toBeInTheDocument();
    await userEvent.click(screen.getAllByText("삭제")[0]);
    expect(screen.queryByText("삼성전자")).not.toBeInTheDocument();
    expect(getWatchlist()).toEqual(["SK하이닉스"]);
  });

  it("imports newline-separated text", async () => {
    render(<Page />);
    await userEvent.click(screen.getByText("불러오기"));
    const ta = screen.getByLabelText("관심종목 텍스트");
    await userEvent.clear(ta);
    await userEvent.type(ta, "카카오\nNAVER");
    await userEvent.click(screen.getByText("이 내용으로 저장"));
    expect(getWatchlist()).toEqual(["카카오", "NAVER"]);
  });
});
