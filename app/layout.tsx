import type { ReactNode } from "react";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata = {
  title: "증권 뉴스레터 도우미",
  manifest: "/manifest.webmanifest",
};
export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" as const };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
