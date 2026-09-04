// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecItem from "./RecItem";
import type { RecItem as RecItemT } from "@/lib/types";

const rec: RecItemT = {
  stock: "삼성전자", mentionCount: 4, brokerages: ["삼성", "미래에셋", "KB", "NH"],
  items: [
    { stock: "삼성전자", title: "목표가 상향", brokerage: "삼성", date: "2026-09-03", sourceSite: "naver", sourceUrl: "u1", kind: "company" },
  ],
  leadComment: "목표가 상향", leadBrokerage: "삼성",
  tags: ["watchlist", "target-up"], isWatchlist: true, hidden: false, score: 0,
};

describe("RecItem", () => {
  it("shows stock, tags, lead comment, and mention count", () => {
    render(<RecItem rec={rec} checked={false} onToggle={() => {}} />);
    expect(screen.getByText("삼성전자")).toBeInTheDocument();
    expect(screen.getByText("관심종목")).toBeInTheDocument();
    expect(screen.getByText("목표가 상향")).toBeInTheDocument();
    expect(screen.getByText("언급 4곳")).toBeInTheDocument();
  });
  it("fires onToggle with the stock when the checkbox is clicked", async () => {
    const onToggle = vi.fn();
    render(<RecItem rec={rec} checked={false} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledWith("삼성전자");
  });
  it("expands to show underlying reports on row click", async () => {
    render(<RecItem rec={rec} checked={false} onToggle={() => {}} />);
    await userEvent.click(screen.getByText("목표가 상향 · 삼성"));
    expect(screen.getByRole("link", { name: "원문" })).toHaveAttribute("href", "u1");
  });

  it("renders one 원문 link per merged sourceUrl", async () => {
    const multi: RecItemT = {
      ...rec,
      items: [{ ...rec.items[0], extraUrls: ["u2"] }],
    };
    render(<RecItem rec={multi} checked={false} onToggle={() => {}} />);
    await userEvent.click(screen.getByText("목표가 상향 · 삼성"));
    const links = screen.getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["u1", "u2"]);
    expect(screen.getByText("원문 1")).toBeInTheDocument();
    expect(screen.getByText("원문 2")).toBeInTheDocument();
  });
});
