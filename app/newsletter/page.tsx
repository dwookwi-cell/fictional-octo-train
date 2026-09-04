"use client";
import { useEffect, useMemo, useState } from "react";
import { buildNewsletter } from "@/lib/newsletter";
import { recommend } from "@/lib/recommend";
import { formatKoreanDate, kstNow } from "@/lib/dates";
import {
  loadCollection, loadSelection, loadMarketSelection, loadChatroom,
  getWatchlist, loadPrevTargetPrices, saveDraft, loadDraft,
} from "@/lib/storage";

const todayYmd = () => kstNow().toISOString().slice(0, 10);

export default function Page() {
  const [text, setText] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const initial = useMemo(() => {
    const collection = loadCollection();
    if (!collection) return "수집된 자료가 없습니다. ‘추천’ 탭에서 새로고침하세요.";
    const chat = loadChatroom();
    const recs = recommend({
      items: collection.items,
      watchlist: getWatchlist(),
      chatroomStocks: chat.matched,
      prevTargetPrices: loadPrevTargetPrices(todayYmd()),
    });
    const selectedStocks = new Set(loadSelection());
    const selectedUrls = new Set(loadMarketSelection());
    const company = recs.company.filter((r) => selectedStocks.has(r.stock));
    const market = recs.market.filter((m) => selectedUrls.has(m.sourceUrl));
    const chatMatchedNotInRecs = chat.matched.filter(
      (s) => !recs.company.some((r) => r.stock === s),
    );
    return buildNewsletter({
      dateLabel: formatKoreanDate(),
      company,
      market,
      chatroomExtra: chatMatchedNotInRecs.map((s) => ({ stock: s, note: "단톡방 언급" })),
      chatroomRaw: chatMatchedNotInRecs.length ? undefined : chat.raw || undefined,
    });
  }, []);

  useEffect(() => {
    const draft = loadDraft();
    setText(draft ?? initial);
  }, [initial]);

  const onChange = (v: string) => {
    setText(v);
    saveDraft(v);
  };

  const copy = async () => {
    if (text) await navigator.clipboard.writeText(text);
    setNote("복사했습니다.");
  };

  const sendKakao = async () => {
    if (!text) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        setNote("공유창을 열었습니다. ‘나와의 채팅’을 선택하세요.");
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(text);
      setNote("이 브라우저는 공유를 지원하지 않아 복사했습니다. 카카오톡에 붙여넣으세요.");
    }
  };

  return (
    <main>
      <h1 style={{ fontSize: 18 }}>뉴스레터 초안</h1>
      <textarea
        value={text ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={20}
        style={{ width: "100%", padding: 10, fontSize: 14, lineHeight: 1.5 }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={copy}>전체 복사</button>
        <button
          onClick={sendKakao}
          style={{ background: "#fee500", border: 0, borderRadius: 6, padding: "8px 14px" }}
        >
          카톡으로 보내기
        </button>
      </div>
      {note && <p style={{ fontSize: 13, color: "#0b62d6" }}>{note}</p>}
    </main>
  );
}
