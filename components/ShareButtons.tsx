"use client";
import { useState } from "react";

export default function ShareButtons({ text }: { text: string }) {
  const [note, setNote] = useState("");

  const copy = async () => {
    if (text) await navigator.clipboard.writeText(text);
    setNote("복사했습니다.");
  };

  const sendKakao = async () => {
    if (!text) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        setNote("공유창을 열었습니다. '나와의 채팅'을 선택하세요.");
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          await navigator.clipboard.writeText(text);
          setNote("공유에 실패해 전체 복사했습니다. 카카오톡에 붙여넣으세요.");
        }
      }
    } else {
      await navigator.clipboard.writeText(text);
      setNote("이 브라우저는 공유를 지원하지 않아 복사했습니다. 카카오톡에 붙여넣으세요.");
    }
  };

  return (
    <>
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
    </>
  );
}
