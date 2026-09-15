export const MEMO_TAGS = ["한마디", "밤", "장", "테마", "종목", "볼것", "노트"] as const;
export type MemoTag = (typeof MEMO_TAGS)[number];
export interface MemoItem {
  tag: MemoTag | null; // null = 태그 없음
  memo: string;
  url?: string;
}

// [나] [오후 3:41] 내용
const MOBILE = /^\[[^\]]*\]\s*\[(?:오전|오후)\s*\d{1,2}:\d{2}\]\s?(.*)$/;
// 2026. 9. 15. 오전 7:31, 나 : 내용
const PC = /^\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.\s*(?:오전|오후)\s*\d{1,2}:\d{2},\s*.+?\s:\s?(.*)$/;
// --------------- 2026년 9월 15일 화요일 ---------------
const DATE_LINE = /^-*\s*\d{4}년\s*\d{1,2}월\s*\d{1,2}일(?:\s*\S+요일)?\s*-*$/;
// lookahead so "#장기투자" is not read as #장
const TAG = new RegExp(`#(${MEMO_TAGS.join("|")})(?![\\p{L}\\p{N}_])`, "u");
// path/query stop at whitespace/quotes/brackets/Hangul (so Korean text glued
// directly onto a URL, e.g. "...x에서", is not swallowed); a "#" fragment is
// more permissive and may itself contain Hangul (e.g. "...page#장")
const URL_RE = /https?:\/\/[^\s<>"'가-힣#]+(?:#[^\s<>"']*)?/;

function toMessages(text: string): string[] {
  const lines = text.split(/\r?\n/);
  if (!lines.some((l) => MOBILE.test(l) || PC.test(l))) return lines;
  const out: string[] = [];
  for (const line of lines) {
    const m = line.match(MOBILE) ?? line.match(PC);
    if (m) out.push(m[1]);
    else if (out.length && !DATE_LINE.test(line.trim())) out[out.length - 1] += "\n" + line;
  }
  return out;
}

const cutAt = (s: string, start: number, len: number) => s.slice(0, start) + " " + s.slice(start + len);
const cut = (s: string, m: RegExpMatchArray) => cutAt(s, m.index!, m[0].length);

export function parseMemos(text: string): MemoItem[] {
  const seen = new Set<string>();
  const items: MemoItem[] = [];
  for (const msg of toMessages(text)) {
    if (DATE_LINE.test(msg.trim())) continue;
    let rest = msg;
    // URL first, so a "#tag"-shaped fragment inside a URL (e.g. "...page#장")
    // is claimed by the URL and never mistaken for the tag marker below.
    const urlM = rest.match(URL_RE);
    let url: string | undefined;
    if (urlM) {
      const trailing = urlM[0].match(/[).,]+$/)?.[0] ?? "";
      url = urlM[0].slice(0, urlM[0].length - trailing.length);
      rest = cutAt(rest, urlM.index!, urlM[0].length - trailing.length);
    }
    const tagM = rest.match(TAG);
    if (tagM) rest = cut(rest, tagM);
    const memo = rest.replace(/\s+/g, " ").trim();
    if (!memo && !url) continue;
    if (url) {
      if (seen.has(url)) continue;
      seen.add(url);
    }
    items.push({ tag: (tagM?.[1] as MemoTag | undefined) ?? null, memo, ...(url ? { url } : {}) });
  }
  return items;
}
