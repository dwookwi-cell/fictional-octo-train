"use client";
import { useEffect, useState } from "react";
import { getWatchlist, setWatchlist } from "@/lib/storage";

export default function Page() {
  const [list, setList] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => setList(getWatchlist()), []);
  const commit = (next: string[]) => {
    setWatchlist(next);
    setList(getWatchlist());
  };

  return (
    <main>
      <h1 style={{ fontSize: 18 }}>관심종목</h1>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          placeholder="종목명 입력"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ flex: 1, padding: 8 }}
        />
        <button
          onClick={() => {
            if (input.trim()) commit([...list, input.trim()]);
            setInput("");
          }}
        >
          추가
        </button>
      </div>

      <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
        {list.map((s, i) => (
          <li
            key={s}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: "1px solid #eee",
            }}
          >
            <span>{s}</span>
            <button onClick={() => commit(list.filter((_, j) => j !== i))}>삭제</button>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button
          onClick={() => {
            setText(list.join("\n"));
            setImportOpen(true);
          }}
        >
          내보내기
        </button>
        <button
          onClick={() => {
            setText("");
            setImportOpen(true);
          }}
        >
          불러오기
        </button>
      </div>

      {importOpen && (
        <div style={{ marginTop: 12 }}>
          <label htmlFor="wl-text" style={{ display: "block", fontSize: 13, color: "#666" }}>
            관심종목 텍스트
          </label>
          <textarea
            id="wl-text"
            aria-label="관심종목 텍스트"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            style={{ width: "100%", padding: 8 }}
          />
          <button
            onClick={() => {
              commit(text.split("\n"));
              setImportOpen(false);
            }}
          >
            이 내용으로 저장
          </button>
        </div>
      )}
    </main>
  );
}
