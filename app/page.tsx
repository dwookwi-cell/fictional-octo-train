"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RecItem from "@/components/RecItem";
import { recommend } from "@/lib/recommend";
import { parseChatroom } from "@/lib/kakaoParse";
import { formatKoreanDate, todayYmdKST } from "@/lib/dates";
import type { CollectionResult } from "@/lib/types";
import {
  loadCollection, saveCollection, saveSnapshot, loadPrevTargetPrices,
  getWatchlist, saveSelection, saveMarketSelection, saveChatroom, clearDraft,
} from "@/lib/storage";

const FRESH_MS = 30 * 60 * 1000;
const todayYmd = todayYmdKST;
const SOURCE_LABEL: Record<string, string> = { naver: "네이버", hankyung: "한경" };
const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function Page() {
  const router = useRouter();
  const [collection, setCollection] = useState<CollectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [chatInput, setChatInput] = useState("");
  const [chat, setChat] = useState<{ matched: string[]; raw: string }>({ matched: [], raw: "" });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/collect");
      if (res.ok) {
        const data: CollectionResult = await res.json();
        saveCollection(data);
        saveSnapshot(todayYmd(), data.items);
        setCollection(data);
        setFailed(false);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = loadCollection();
    if (cached && Date.now() - new Date(cached.collectedAt).getTime() < FRESH_MS) {
      setCollection(cached);
    } else {
      void refresh();
    }
  }, [refresh]);

  const recs = useMemo(() => {
    if (!collection) return null;
    return recommend({
      items: collection.items,
      watchlist: getWatchlist(),
      chatroomStocks: chat.matched,
      prevTargetPrices: loadPrevTargetPrices(todayYmd()),
    });
  }, [collection, chat]);

  const toggle = (stock: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(stock)) next.delete(stock);
      else next.add(stock);
      return next;
    });

  const includeChat = () => {
    const dict = (collection?.items.map((i) => i.stock) ?? []).concat(getWatchlist());
    const parsed = parseChatroom(chatInput, dict);
    const state = { matched: parsed.matchedStocks, raw: parsed.rawText };
    setChat(state);
    saveChatroom(state);
  };

  const goNewsletter = () => {
    const marketUrls = (recs?.market ?? []).map((m) => m.sourceUrl);
    saveSelection([...checked].filter((k) => !marketUrls.includes(k)));
    saveMarketSelection(marketUrls.filter((u) => checked.has(u)));
    saveChatroom(chat);
    clearDraft(); // fresh selection must not be shadowed by an old edited draft

    router.push("/newsletter");
  };

  const visibleCompany = (recs?.company ?? []).filter((r) => showAll || !r.hidden);

  return (
    <main style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 18 }}>오늘의 추천</h1>
        <span style={{ fontSize: 12, color: "#888" }}>{formatKoreanDate()}</span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0" }}>
        <button onClick={() => void refresh()} disabled={loading}>
          {loading ? "수집 중…" : "새로고침"}
        </button>
        <button onClick={() => setShowAll((v) => !v)}>{showAll ? "추천만 보기" : "전체 보기"}</button>
        {collection && (
          <span style={{ fontSize: 12, color: "#888" }}>마지막 수집: {hhmm(collection.collectedAt)}</span>
        )}
        {collection?.failures.map((f) => (
          <span key={f} style={{ fontSize: 12, color: "#c00" }}>{SOURCE_LABEL[f] ?? f} 수집 실패</span>
        ))}
      </div>

      {(failed || collection?.failures.length === 2) && (
        <p style={{ color: "#c00" }}>수집에 실패했습니다. 잠시 후 새로고침 해주세요.</p>
      )}

      {recs && visibleCompany.length === 0 && collection?.failures.length !== 2 && (
        <p style={{ color: "#666" }}>오늘은 2곳 이상 겹친 종목이 없습니다. “전체 보기”로 전체 리포트를 확인하세요.</p>
      )}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {visibleCompany.map((r) => (
          <RecItem key={r.stock} rec={r} checked={checked.has(r.stock)} onToggle={toggle} />
        ))}
      </ul>

      {recs && recs.industry.length > 0 && (
        <>
          <h2 style={{ fontSize: 15, marginTop: 16 }}>산업</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {recs.industry.map((r) => (
              <li key={r.stock} style={{ padding: "8px 0", borderBottom: "1px solid #eee", fontSize: 14 }}>
                • {r.stock} · {r.leadBrokerage}
              </li>
            ))}
          </ul>
        </>
      )}

      {recs && recs.market.length > 0 && (
        <>
          <h2 style={{ fontSize: 15, marginTop: 16 }}>시황</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {recs.market.map((m) => (
              <li key={m.sourceUrl} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
                <label style={{ display: "flex", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={checked.has(m.sourceUrl)}
                    onChange={() => toggle(m.sourceUrl)}
                  />
                  <span style={{ fontSize: 14 }}>{m.title} · {m.brokerage}</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 style={{ fontSize: 15, marginTop: 16 }}>카톡방 내용 붙여넣기</h2>
      <textarea
        placeholder="카톡방에서 복사한 내용을 붙여넣으세요"
        value={chatInput}
        onChange={(e) => setChatInput(e.target.value)}
        rows={4}
        style={{ width: "100%", padding: 8 }}
      />
      <button onClick={includeChat}>분석에 포함</button>
      {chat.matched.length > 0 && (
        <p style={{ fontSize: 13, color: "#0b62d6" }}>반영된 종목: {chat.matched.join(", ")}</p>
      )}
      {chat.raw && chat.matched.length === 0 && (
        <p style={{ fontSize: 13, color: "#666" }}>종목을 찾지 못했습니다. 원문은 뉴스레터에 첨부됩니다.</p>
      )}

      <div style={{ position: "sticky", bottom: 72, marginTop: 20 }}>
        <button
          onClick={goNewsletter}
          disabled={checked.size === 0}
          style={{ width: "100%", padding: 14, background: "#0b62d6", color: "#fff", border: 0, borderRadius: 8 }}
        >
          선택한 항목으로 뉴스레터 만들기
        </button>
      </div>
    </main>
  );
}
