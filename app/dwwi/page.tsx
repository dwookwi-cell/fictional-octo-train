"use client";
import { useEffect, useState } from "react";
import ShareButtons from "@/components/ShareButtons";
import { MEMO_TAGS, parseMemos, type MemoItem, type MemoTag } from "@/lib/memoParse";
import { buildDwwi } from "@/lib/dwwi";
import type { LinkInfo } from "@/lib/linkInfo";
import { formatKoreanDate } from "@/lib/dates";
import { loadMemoDraft, loadMemoPaste, saveMemoDraft, saveMemoPaste } from "@/lib/storage";

const GROUPS: (MemoTag | null)[] = [...MEMO_TAGS.filter((t) => t !== "노트"), null];

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export default function Page() {
  const [paste, setPaste] = useState("");
  const [items, setItems] = useState<MemoItem[] | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [infos, setInfos] = useState<Record<string, LinkInfo>>({});
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    setPaste(loadMemoPaste());
    const saved = loadMemoDraft();
    if (saved) setDraft(saved);
  }, []);

  const organize = async () => {
    saveMemoPaste(paste);
    const parsed = parseMemos(paste).filter((m) => m.tag !== "노트");
    setItems(parsed);
    setExcluded(new Set());
    setInfos({});
    const urls = parsed.flatMap((m) => (m.url ? [m.url] : []));
    if (!urls.length) return;
    setLoadingInfo(true);
    try {
      const res = await fetch("/api/linkinfo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      if (res.ok) setInfos(await res.json());
    } catch {
      /* 기사 정보 없이 메모만으로 진행 */
    } finally {
      setLoadingInfo(false);
    }
  };

  const toggle = (i: number) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const makeDraft = () => {
    const chosen = (items ?? []).filter((_, i) => !excluded.has(i));
    const text = buildDwwi(formatKoreanDate(), chosen, infos);
    setDraft(text);
    saveMemoDraft(text);
  };

  const editDraft = (v: string) => {
    setDraft(v);
    saveMemoDraft(v);
  };

  const chosenCount = (items?.length ?? 0) - excluded.size;

  return (
    <main>
      <h1 style={{ fontSize: 18 }}>dwwi</h1>
      <label htmlFor="memo-paste" style={{ display: "block", fontSize: 13, color: "#555", margin: "8px 0 4px" }}>
        나와의 채팅에서 복사한 내용
      </label>
      <textarea
        id="memo-paste"
        value={paste}
        onChange={(e) => {
          const v = e.target.value;
          setPaste(v);
          saveMemoPaste(v);
        }}
        placeholder="#테마 로봇 기사 https://…"
        rows={6}
        style={{ width: "100%", padding: 8, fontSize: 16 }}
      />
      <button onClick={() => void organize()} disabled={!paste.trim() || loadingInfo}>
        정리하기
      </button>

      {items && items.length === 0 && (
        <p style={{ color: "#c00" }}>
          정리할 메시지를 찾지 못했습니다. 나와의 채팅에서 복사한 내용을 그대로 붙여넣으세요.
        </p>
      )}
      {loadingInfo && <p style={{ fontSize: 13, color: "#888" }}>기사 정보 가져오는 중…</p>}

      {items &&
        GROUPS.map((tag) => {
          const rows = items.map((it, i) => ({ it, i })).filter(({ it }) => it.tag === tag);
          if (!rows.length) return null;
          return (
            <section key={tag ?? "none"}>
              <h2 style={{ fontSize: 15, marginTop: 16 }}>{tag ? `#${tag}` : "태그 없음"}</h2>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {rows.map(({ it, i }) => (
                  <li key={i} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
                    <label style={{ display: "flex", gap: 10 }}>
                      <input type="checkbox" checked={!excluded.has(i)} onChange={() => toggle(i)} />
                      <span style={{ fontSize: 14 }}>
                        {it.memo || "(메모 없음)"}
                        {it.url && (
                          <span style={{ display: "block", fontSize: 12, color: "#888" }}>
                            {hostOf(it.url)}
                            {infos[it.url]?.title ? ` · ${infos[it.url].title}` : ""}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

      {items && items.length > 0 && (
        <button
          onClick={makeDraft}
          disabled={chosenCount === 0}
          style={{ width: "100%", padding: 14, marginTop: 16, background: "#0b62d6", color: "#fff", border: 0, borderRadius: 8 }}
        >
          초안 만들기
        </button>
      )}

      {draft !== null && (
        <>
          <textarea
            aria-label="초안"
            value={draft}
            onChange={(e) => editDraft(e.target.value)}
            rows={16}
            style={{ width: "100%", padding: 10, marginTop: 16, fontSize: 16, lineHeight: 1.5 }}
          />
          <ShareButtons text={draft} />
        </>
      )}
    </main>
  );
}
