"use client";
import { useState } from "react";
import type { RecItem as RecItemT, RecTag } from "@/lib/types";

const TAG_LABEL: Record<RecTag, string> = {
  watchlist: "관심종목",
  "target-up": "목표가 상향",
  "target-down": "목표가 하향",
  "new-coverage": "신규 커버리지",
  chatroom: "단톡방 언급",
};

export default function RecItem({
  rec, checked, onToggle,
}: {
  rec: RecItemT;
  checked: boolean;
  onToggle: (stock: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li style={{ borderBottom: "1px solid #eee", padding: "10px 0" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(rec.stock)}
          style={{ marginTop: 3 }}
        />
        <div style={{ flex: 1 }} onClick={() => setOpen((v) => !v)}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <strong>{rec.stock}</strong>
            {rec.tags.map((t) => (
              <span key={t} style={chip}>{TAG_LABEL[t]}</span>
            ))}
            <span style={chip}>언급 {rec.mentionCount}곳</span>
            {typeof rec.targetPriceChangePct === "number" && rec.targetPriceChangePct !== 0 && (
              <span style={chip}>목표가 {rec.targetPriceChangePct > 0 ? "+" : ""}{rec.targetPriceChangePct}%</span>
            )}
          </div>
          <div style={{ color: "#444", fontSize: 14, marginTop: 4 }}>
            {rec.leadComment} · {rec.leadBrokerage}
          </div>
          {open && (
            <ul style={{ margin: "8px 0 0", paddingLeft: 16 }}>
              {rec.items.map((it, i) => {
                const urls = [it.sourceUrl, ...(it.extraUrls ?? [])];
                return (
                  <li key={i} style={{ fontSize: 13, color: "#555" }}>
                    <span>{it.title} · {it.brokerage}</span>
                    {urls.map((u, j) => (
                      <span key={j}>
                        {" "}
                        <a href={u} target="_blank" rel="noreferrer">
                          {urls.length > 1 ? `원문 ${j + 1}` : "원문"}
                        </a>
                      </span>
                    ))}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

const chip: React.CSSProperties = {
  fontSize: 11, background: "#eef3fb", color: "#0b62d6",
  borderRadius: 10, padding: "2px 7px", whiteSpace: "nowrap",
};
