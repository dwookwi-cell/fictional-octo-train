// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Page from "./page";

const INSIGHT = "https://www.insight.co.kr/news/549347";
const PASTE = [
  "[나] [오후 3:41] #장 코스피 +6.8% 개인 7조 매도 https://markets.hankyung.com/marketmap/kospi",
  `[나] [오후 9:02] #테마 ${INSIGHT}`,
  "[나] [오후 9:10] #노트 삼천당 50~60 구간",
  "[나] [오후 9:15] #한마디 오늘은 쉬어가기",
].join("\n");

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ [INSIGHT]: { title: "‘중국산 로봇’ 철퇴 준비중인 미국" } }),
  }));
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
});

async function pasteAndOrganize(text = PASTE) {
  await userEvent.click(screen.getByLabelText("나와의 채팅에서 복사한 내용"));
  await userEvent.paste(text);
  await userEvent.click(screen.getByText("정리하기"));
}

describe("끄적임 screen", () => {
  it("groups messages by tag in newsletter order, hides #노트, shows fetched titles", async () => {
    render(<Page />);
    await pasteAndOrganize();
    expect(await screen.findByText(/중국산 로봇/)).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["#한마디", "#장", "#테마"]);
    expect(screen.queryByText(/삼천당/, { ignore: "script, style, textarea" })).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/linkinfo", expect.objectContaining({ method: "POST" }));
  });

  it("leaves unchecked items out of the draft and saves the draft", async () => {
    render(<Page />);
    await pasteAndOrganize();
    await screen.findByText(/중국산 로봇/);
    await userEvent.click(screen.getByRole("checkbox", { name: /오늘은 쉬어가기/ }));
    await userEvent.click(screen.getByText("초안 만들기"));
    const draft = screen.getByRole("textbox", { name: "초안" }) as HTMLTextAreaElement;
    expect(draft.value).toContain("오늘의 끄적임 · ");
    expect(draft.value).not.toContain("쉬어가기");
    expect(draft.value).toContain("1. https://markets.hankyung.com/marketmap/kospi\n사실: 코스피 +6.8% 개인 7조 매도\n해석: ");
    expect(draft.value).toContain(`2. ${INSIGHT}\n사실: ‘중국산 로봇’ 철퇴 준비중인 미국\n해석: `);
    expect(localStorage.getItem("snl:memoDraft")).toContain("오늘의 끄적임");
  });

  it("still lists items when link info cannot be fetched", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }) as unknown as typeof fetch);
    render(<Page />);
    await pasteAndOrganize();
    expect(await screen.findByText("코스피 +6.8% 개인 7조 매도")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/기사 정보 가져오는 중/)).toBeNull());
  });

  it("explains when no usable message was found", async () => {
    render(<Page />);
    await pasteAndOrganize("[나] [오전 7:00] #노트 메모만");
    expect(screen.getByText(/정리할 메시지를 찾지 못했습니다/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("restores the saved paste and draft on entry", async () => {
    localStorage.setItem("snl:memoPaste", JSON.stringify("#장 코스피"));
    localStorage.setItem("snl:memoDraft", JSON.stringify("수정하던 초안"));
    render(<Page />);
    expect(await screen.findByDisplayValue("수정하던 초안")).toBeInTheDocument();
    expect(screen.getByLabelText("나와의 채팅에서 복사한 내용")).toHaveValue("#장 코스피");
  });

  it("saves the paste to storage as it is typed, before 정리하기 is pressed", async () => {
    render(<Page />);
    await userEvent.click(screen.getByLabelText("나와의 채팅에서 복사한 내용"));
    await userEvent.paste("#장 코스피");
    expect(localStorage.getItem("snl:memoPaste")).toContain("코스피");
  });

  it("disables 정리하기 while link info is loading and re-enables after", async () => {
    let resolveFetch!: (v: { ok: boolean; json: () => Promise<unknown> }) => void;
    fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    render(<Page />);
    await userEvent.click(screen.getByLabelText("나와의 채팅에서 복사한 내용"));
    await userEvent.paste(PASTE);
    const button = screen.getByText("정리하기");
    await userEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    resolveFetch({ ok: true, json: async () => ({}) });
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
