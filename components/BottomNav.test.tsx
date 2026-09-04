// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BottomNav from "./BottomNav";

vi.mock("next/navigation", () => ({ usePathname: () => "/newsletter" }));

describe("BottomNav", () => {
  it("renders the three tabs", () => {
    render(<BottomNav />);
    expect(screen.getByRole ? screen.getByText("추천") : screen.getByText("추천")).toBeInTheDocument();
    expect(screen.getByText("뉴스레터")).toBeInTheDocument();
    expect(screen.getByText("관심종목")).toBeInTheDocument();
  });
  it("marks the active tab with aria-current", () => {
    render(<BottomNav />);
    expect(screen.getByText("뉴스레터").closest("a")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("추천").closest("a")).not.toHaveAttribute("aria-current");
  });
});
