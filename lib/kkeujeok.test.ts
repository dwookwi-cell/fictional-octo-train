import { describe, it, expect } from "vitest";
import { buildKkeujeok, factLine } from "./kkeujeok";

describe("factLine", () => {
  it("uses the memo alone when there is no article info", () =>
    expect(factLine({ tag: "장", memo: "코스피 +6.8%" })).toBe("코스피 +6.8%"));

  it("uses the article title alone when there is no memo", () =>
    expect(factLine({ tag: "테마", memo: "", url: "u" }, { title: "중국산 로봇" })).toBe("중국산 로봇"));

  it("joins memo, (기사: title) and the first sentence of a differing description", () =>
    expect(
      factLine(
        { tag: "테마", memo: "로봇 기사", url: "u" },
        { title: "중국산 로봇", description: "미국이 차단 법안을 발의했다. 수혜 기대." },
      ),
    ).toBe("로봇 기사 (기사: 중국산 로봇) 미국이 차단 법안을 발의했다."));

  it("skips a description identical to the title", () =>
    expect(factLine({ tag: "밤", memo: "", url: "u" }, { title: "휴전 동의", description: "휴전 동의" })).toBe("휴전 동의"));

  it("is empty when there is nothing", () => expect(factLine({ tag: null, memo: "", url: "u" })).toBe(""));
});

describe("buildKkeujeok", () => {
  it("numbers items in tag order, keeps paste order within a tag, drops #노트", () => {
    const out = buildKkeujeok(
      "2026년 9월 15일",
      [
        { tag: null, memo: "태그없음" },
        { tag: "테마", memo: "테마1", url: "https://t1.example.com" },
        { tag: "노트", memo: "노트" },
        { tag: "장", memo: "장1" },
        { tag: "테마", memo: "테마2" },
        { tag: "한마디", memo: "한마디" },
      ],
      { "https://t1.example.com": { title: "기사제목" } },
    );
    expect(out).toBe(
      [
        "오늘의 끄적임 · 2026년 9월 15일",
        "1.\n사실: 한마디\n해석: \n내 생각: ",
        "2.\n사실: 장1\n해석: \n내 생각: ",
        "3. https://t1.example.com\n사실: 테마1 (기사: 기사제목)\n해석: \n내 생각: ",
        "4.\n사실: 테마2\n해석: \n내 생각: ",
        "5.\n사실: 태그없음\n해석: \n내 생각: ",
      ].join("\n\n"),
    );
  });
});
