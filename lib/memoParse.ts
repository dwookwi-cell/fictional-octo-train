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
const URL_RE = /https?:\/\/[^\s<>"']+/;

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

const cut = (s: string, m: RegExpMatchArray) =>
  s.slice(0, m.index) + " " + s.slice(m.index! + m[0].length);

export function parseMemos(text: string): MemoItem[] {
  const seen = new Set<string>();
  const items: MemoItem[] = [];
  for (const msg of toMessages(text)) {
    if (DATE_LINE.test(msg.trim())) continue;
    let rest = msg;
    const tagM = rest.match(TAG);
    if (tagM) rest = cut(rest, tagM);
    const urlM = rest.match(URL_RE);
    if (urlM) rest = cut(rest, urlM);
    const memo = rest.replace(/\s+/g, " ").trim();
    const url = urlM?.[0];
    if (!memo && !url) continue;
    if (url) {
      if (seen.has(url)) continue;
      seen.add(url);
    }
    items.push({ tag: (tagM?.[1] as MemoTag | undefined) ?? null, memo, ...(url ? { url } : {}) });
  }
  return items;
}
