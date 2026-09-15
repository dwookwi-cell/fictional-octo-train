"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "추천" },
  { href: "/newsletter", label: "뉴스레터" },
  { href: "/kkeujeok", label: "끄적임" },
  { href: "/watchlist", label: "관심종목" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      style={{
        position: "fixed", bottom: 0, left: 0, right: 0, display: "flex",
        borderTop: "1px solid #e2e2e2", background: "#fff",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            style={{
              flex: 1, textAlign: "center", padding: "12px 0", textDecoration: "none",
              color: active ? "#0b62d6" : "#666", fontWeight: active ? 700 : 400, fontSize: 14,
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
