import { describe, it, expect } from "vitest";
import { parseMemos } from "./memoParse";

describe("parseMemos", () => {
  it("splits mobile-copied messages, drops date separators, joins continuation lines", () => {
    const text = [
      "--------------- 2026년 9월 15일 화요일 ---------------",
      "[나] [오후 3:41] #장 코스피 +6.8% 개인 7조 매도 https://markets.hankyung.com/marketmap/kospi",
      "[나] [오후 9:02] #테마 로봇 기사",
      "https://www.insight.co.kr/news/549347",
    ].join("\n");
    expect(parseMemos(text)).toEqual([
      { tag: "장", memo: "코스피 +6.8% 개인 7조 매도", url: "https://markets.hankyung.com/marketmap/kospi" },
      { tag: "테마", memo: "로봇 기사", url: "https://www.insight.co.kr/news/549347" },
    ]);
  });

  it("splits PC-exported messages and ignores header lines before the first message", () => {
    const text = [
      "나와의 채팅 님과 카카오톡 대화",
      "저장한 날짜 : 2026-09-15 07:40",
      "",
      "2026년 9월 15일 화요일",
      "2026. 9. 15. 오전 7:31, 나 : #밤 유가 -15% https://n.news.naver.com/mnews/article/374/0000502976",
      "2026. 9. 15. 오전 7:32, 나 : #볼것 스페이스X 나스닥100 편입",
    ].join("\r\n");
    expect(parseMemos(text)).toEqual([
      { tag: "밤", memo: "유가 -15%", url: "https://n.news.naver.com/mnews/article/374/0000502976" },
      { tag: "볼것", memo: "스페이스X 나스닥100 편입" },
    ]);
  });

  it("treats each line as a message when nothing has a KakaoTalk prefix", () => {
    expect(parseMemos("#종목 삼천당제약 넥스트장 +17%\n\n그냥 메모 한 줄\n")).toEqual([
      { tag: "종목", memo: "삼천당제약 넥스트장 +17%" },
      { tag: null, memo: "그냥 메모 한 줄" },
    ]);
  });

  it("recognises only the seven tags and leaves other #words as text", () => {
    const text = [
      "#한마디 영화 작전 https://www.youtube.com/shorts/MPPIWQ0PDcc #쇼츠",
      "#장기투자 이야기",
      "#노트 삼천당 50~60 구간",
    ].join("\n");
    expect(parseMemos(text)).toEqual([
      { tag: "한마디", memo: "영화 작전 #쇼츠", url: "https://www.youtube.com/shorts/MPPIWQ0PDcc" },
      { tag: null, memo: "#장기투자 이야기" },
      { tag: "노트", memo: "삼천당 50~60 구간" },
    ]);
  });

  it("keeps the first URL only, drops repeated links and empty messages", () => {
    const text = [
      "#테마 두 링크 https://a.example.com/1 https://b.example.com/2",
      "#종목 같은 링크 https://a.example.com/1",
      "#종목 삼성전자",
      "#장",
    ].join("\n");
    expect(parseMemos(text)).toEqual([
      { tag: "테마", memo: "두 링크 https://b.example.com/2", url: "https://a.example.com/1" },
      { tag: "종목", memo: "삼성전자" },
    ]);
  });
});
