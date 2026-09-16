"use client";
import { useEffect, useMemo, useState } from "react";
import { buildNewsletter } from "@/lib/newsletter";
import { recommend } from "@/lib/recommend";
import { formatKoreanDate, todayYmdKST } from "@/lib/dates";
import {
  loadCollection, loadSelection, loadMarketSelection, loadChatroom,
  getWatchlist, loadPrevTargetPrices, saveDraft, loadDraft,
} from "@/lib/storage";
import ShareButtons from "@/components/ShareButtons";

const todayYmd = todayYmdKST;

export default function Page() {
  const [text, setText] = useState<string | null>(null);

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
      chatroomRaw: chat.matched.length === 0 ? (chat.raw || undefined) : undefined,
    });
  }, []);

  useEffect(() => {
    const draft = loadDraft();
    setText(draft && draft.length > 0 ? draft : initial);
  }, [initial]);

  const onChange = (v: string) => {
    setText(v);
    saveDraft(v);
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
      <ShareButtons text={text ?? ""} />
    </main>
  );
}
