import { MEMO_TAGS, type MemoItem } from "./memoParse";
import type { LinkInfo } from "./linkInfo";

const firstSentence = (s: string) => s.split(/(?<=[.!?])\s/)[0].trim();

export function factLine(item: MemoItem, info?: LinkInfo): string {
  const parts: string[] = [];
  if (item.memo) parts.push(item.memo);
  if (info?.title) parts.push(item.memo ? `(기사: ${info.title})` : info.title);
  if (info?.description && info.description !== info.title) parts.push(firstSentence(info.description));
  return parts.join(" ");
}

// untagged items go last; Array.prototype.sort is stable, so paste order holds within a tag
const rank = (t: MemoItem["tag"]) => (t === null ? MEMO_TAGS.length : MEMO_TAGS.indexOf(t));

export function buildKkeujeok(dateLabel: string, items: MemoItem[], infos: Record<string, LinkInfo>): string {
  const blocks = items
    .filter((it) => it.tag !== "노트")
    .sort((a, b) => rank(a.tag) - rank(b.tag))
    .map((it, i) =>
      [
        `${i + 1}.${it.url ? ` ${it.url}` : ""}`,
        `사실: ${factLine(it, it.url ? infos[it.url] : undefined)}`,
        "해석: ",
        "내 생각: ",
      ].join("\n"),
    );
  return [`오늘의 끄적임 · ${dateLabel}`, ...blocks].join("\n\n");
}
