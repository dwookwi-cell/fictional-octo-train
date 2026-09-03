# 증권 뉴스레터 도우미 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile web app that each morning collects Korean brokerage research from Naver Finance and Hankyung Consensus, recommends newsworthy items by rule (multi-brokerage mentions + user watchlist), assembles a bullet-format newsletter from the user's selection, and shares it to the user's own KakaoTalk "나와의 채팅" via the phone share sheet.

**Architecture:** Single Next.js (App Router) + TypeScript app deployed on Vercel. One server route (`/api/collect`) fetches and parses the two source sites (browser CORS workaround). Everything else is client-side. No database — watchlist, daily snapshots, collected results, selection, and the newsletter draft all live in `localStorage`. No LLM/AI: recommendations are rule-based, the newsletter is template-based. KakaoTalk delivery uses `navigator.share({ text })` with a clipboard-copy fallback — no Kakao developer app, key, or token.

**Tech Stack:** Next.js 14 (App Router), TypeScript, React 18, `cheerio` (HTML parsing), `vitest` + `@testing-library/react` + `jsdom` (tests). Node.js 20 LTS. Deployed on Vercel free tier.

**Spec:** `docs/superpowers/specs/2026-09-03-stock-newsletter-assistant-design.md`

## Global Constraints

Every task's requirements implicitly include this section. Values copied verbatim from the spec.

- **LLM/AI API 사용 안 함.** 추천은 규칙 기반, 뉴스레터는 템플릿 기반.
- **데이터베이스 없음.** 관심종목·일일 스냅샷·수집결과·선택·초안은 브라우저 `localStorage`에만 저장.
- **추천 임계값:** 서로 다른 증권사가 **2곳 이상** 언급한 종목(`kind==="company"`)을 추천 리스트에 포함.
- **수집 범위:** 발행일이 **오늘 또는 어제**(KST 기준)인 항목만.
- **스냅샷 보관:** 최근 **14일치**만 (초과분 삭제).
- **대표 증권사 표기:** 최대 3곳 나열 후 `외, N곳` (예: `삼성·미래에셋·KB 외, 5곳`).
- **카카오 전송:** `navigator.share({ text })` → 미지원 시 클립보드 복사 폴백. 카카오 개발자 등록/키/토큰 없음.
- **자료 출처:** 네이버 금융 리서치(종목분석 `company_list`, 산업분석 `industry_list`, 시황정보 `market_info_list`) + 한경 컨센서스(`consensus.hankyung.com`).
- **UI 문구:** 한국어. 모바일 세로 화면 우선.
- **노이즈 제거:** 언급 1곳 + 관심종목 아님 + 특이 태그(목표가 방향 / 신규 커버리지 / 단톡방) 없음 → 기본 숨김, `[전체 보기]` 토글로 노출.

---

## File Structure

| Path | Responsibility |
|---|---|
| `lib/types.ts` | Shared TypeScript types (`ResearchItem`, `RecItem`, `RecTag`, `CollectionResult`) |
| `lib/dates.ts` | KST date helpers: recency check, loose Korean date parsing, display formatting |
| `lib/normalize.ts` | Stock-name / brokerage-name normalization, item dedup |
| `lib/sources/naver.ts` | Fetch + parse Naver research list pages → `ResearchItem[]` |
| `lib/sources/hankyung.ts` | Fetch + parse Hankyung Consensus list → `ResearchItem[]` |
| `app/api/collect/route.ts` | Server route: run both sources, merge, dedupe, date-filter, report failures |
| `lib/recommend.ts` | Group by stock, count brokerages, apply watchlist, assign tags, sort, mark hidden |
| `lib/stockDictionary.ts` | Bundled static list of major stock names (KOSPI200 + major US names in Korean) |
| `lib/kakaoParse.ts` | Extract stock names from pasted chat-room free text |
| `lib/newsletter.ts` | Assemble selected items into sectioned bullet-format text |
| `lib/storage.ts` | `localStorage` helpers: watchlist, snapshots, collection cache, selection, draft |
| `components/BottomNav.tsx` | Fixed bottom tab bar (추천 / 뉴스레터 / 관심종목) |
| `components/RecItem.tsx` | One recommendation row: checkbox, stock, tags, lead comment, expand |
| `app/layout.tsx` | App shell: viewport meta, bottom nav, PWA manifest link |
| `app/page.tsx` | 화면 ① 오늘의 추천 |
| `app/newsletter/page.tsx` | 화면 ② 뉴스레터 초안 |
| `app/watchlist/page.tsx` | 화면 ③ 관심종목 |
| `public/manifest.webmanifest` | Home-screen install metadata |
| `README.md` | Local run + Vercel deploy instructions for a non-developer |

---

## Task 1: Scaffold + shared types + date & normalize helpers

**Files:**
- Create: `package.json`, `next.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `app/layout.tsx`, `app/page.tsx` (temporary placeholder)
- Create: `lib/types.ts`, `lib/dates.ts`, `lib/normalize.ts`
- Test: `lib/dates.test.ts`, `lib/normalize.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `lib/types.ts`:
    ```ts
    export type SourceSite = "naver" | "hankyung";
    export type ResearchKind = "company" | "industry" | "market";
    export interface ResearchItem {
      stock: string;        // normalized stock / industry / headline label
      title: string;
      brokerage: string;    // normalized brokerage name
      targetPrice?: number;
      opinion?: string;
      date: string;         // "YYYY-MM-DD"
      sourceSite: SourceSite;
      sourceUrl: string;
      kind: ResearchKind;
    }
    export type RecTag = "watchlist" | "target-up" | "target-down" | "new-coverage" | "chatroom";
    export interface RecItem {
      stock: string;
      mentionCount: number;
      brokerages: string[];
      items: ResearchItem[];
      leadComment: string;
      leadBrokerage: string;
      tags: RecTag[];
      targetPriceChangePct?: number;
      isWatchlist: boolean;
      hidden: boolean;
      score: number;
    }
    export interface CollectionResult {
      collectedAt: string;      // ISO timestamp
      items: ResearchItem[];
      failures: SourceSite[];
    }
    ```
  - `lib/dates.ts`:
    ```ts
    export function kstNow(now?: Date): Date;               // Date shifted to KST wall-clock
    export function isRecentKST(dateYmd: string, now?: Date): boolean;  // today or yesterday KST
    export function parseLooseKoreanDate(raw: string, now?: Date): string | null; // -> "YYYY-MM-DD"
    export function formatKoreanDate(now?: Date): string;   // "2026년 9월 3일" (KST)
    ```
  - `lib/normalize.ts`:
    ```ts
    export function normalizeStock(name: string): string;
    export function normalizeBrokerage(name: string): string;
    export function dedupeItems(items: ResearchItem[]): ResearchItem[];
    ```

- [ ] **Step 0: Install Node.js (prerequisite — Node is not currently installed)**

Run in PowerShell:
```
winget install OpenJS.NodeJS.LTS
```
Close and reopen the terminal, then verify:
```
node -v
```
Expected: `v20.x` or newer.

- [ ] **Step 1: Scaffold the Next.js app**

Run in the project root:
```
npm init -y
npm install next@14 react@18 react-dom@18
npm install -D typescript @types/node @types/react @types/react-dom vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event cheerio
```

- [ ] **Step 2: Add config files**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.ts", "**/*.test.tsx"],
  },
  resolve: { alias: { "@": new URL(".", import.meta.url).pathname } },
});
```

Create `vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

Create `.gitignore`:
```
node_modules
.next
out
*.tsbuildinfo
next-env.d.ts
.vercel
```

Add to `package.json` `"scripts"`:
```json
"dev": "next dev",
"build": "next build",
"start": "next start",
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Add placeholder app shell so `next dev` boots**

Create `app/layout.tsx`:
```tsx
import type { ReactNode } from "react";

export const metadata = { title: "증권 뉴스레터 도우미" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
```

Create `app/page.tsx`:
```tsx
export default function Home() {
  return <main style={{ padding: 16 }}>준비 중</main>;
}
```

- [ ] **Step 4: Write failing tests for `lib/dates.ts`**

Create `lib/dates.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { isRecentKST, parseLooseKoreanDate, formatKoreanDate } from "./dates";

const NOW = new Date("2026-09-03T00:30:00Z"); // 2026-09-03 09:30 KST

describe("isRecentKST", () => {
  it("accepts today (KST)", () => expect(isRecentKST("2026-09-03", NOW)).toBe(true));
  it("accepts yesterday (KST)", () => expect(isRecentKST("2026-09-02", NOW)).toBe(true));
  it("rejects two days ago", () => expect(isRecentKST("2026-09-01", NOW)).toBe(false));
  it("rejects the future", () => expect(isRecentKST("2026-09-04", NOW)).toBe(false));
});

describe("parseLooseKoreanDate", () => {
  it("parses YY.MM.DD", () => expect(parseLooseKoreanDate("26.09.02", NOW)).toBe("2026-09-02"));
  it("parses YYYY.MM.DD", () => expect(parseLooseKoreanDate("2026.09.02", NOW)).toBe("2026-09-02"));
  it("parses YYYY-MM-DD", () => expect(parseLooseKoreanDate("2026-09-02", NOW)).toBe("2026-09-02"));
  it("returns null on garbage", () => expect(parseLooseKoreanDate("어제", NOW)).toBeNull());
});

describe("formatKoreanDate", () => {
  it("formats KST date", () => expect(formatKoreanDate(NOW)).toBe("2026년 9월 3일"));
});
```

- [ ] **Step 5: Run — verify fail**

Run: `npm test -- lib/dates.test.ts`
Expected: FAIL (module `./dates` has no such exports).

- [ ] **Step 6: Implement `lib/dates.ts`**

```ts
const KST_OFFSET_MIN = 9 * 60;

export function kstNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + (KST_OFFSET_MIN + now.getTimezoneOffset()) * 60_000);
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isRecentKST(dateYmd: string, now: Date = new Date()): boolean {
  const today = kstNow(now);
  const todayYmd = ymd(today);
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  return dateYmd === todayYmd || dateYmd === ymd(yest);
}

export function parseLooseKoreanDate(raw: string, now: Date = new Date()): string | null {
  const m = raw.trim().match(/^(\d{2}|\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (!m) return null;
  let year = Number(m[1]);
  if (year < 100) year += 2000;
  const month = String(Number(m[2])).padStart(2, "0");
  const day = String(Number(m[3])).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatKoreanDate(now: Date = new Date()): string {
  const d = kstNow(now);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}
```

- [ ] **Step 7: Run — verify pass**

Run: `npm test -- lib/dates.test.ts`
Expected: PASS (all 10).

- [ ] **Step 8: Write failing tests for `lib/normalize.ts`**

Create `lib/normalize.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizeStock, normalizeBrokerage, dedupeItems } from "./normalize";
import type { ResearchItem } from "./types";

describe("normalizeStock", () => {
  it("trims and collapses spaces", () => expect(normalizeStock("  삼성 전자 ")).toBe("삼성전자"));
  it("drops trailing ticker in parens", () => expect(normalizeStock("삼성전자(005930)")).toBe("삼성전자"));
});

describe("normalizeBrokerage", () => {
  it("standardizes known aliases", () => {
    expect(normalizeBrokerage("미래에셋증권")).toBe("미래에셋");
    expect(normalizeBrokerage("삼성증권")).toBe("삼성");
    expect(normalizeBrokerage("KB증권")).toBe("KB");
  });
  it("passes through unknown names trimmed", () => expect(normalizeBrokerage(" 웰스 ")).toBe("웰스"));
});

describe("dedupeItems", () => {
  const base: ResearchItem = {
    stock: "삼성전자", title: "3분기 실적 컨센 상회", brokerage: "삼성",
    date: "2026-09-03", sourceSite: "naver", sourceUrl: "u1", kind: "company",
  };
  it("merges same stock+brokerage+similar title, keeps both urls", () => {
    const out = dedupeItems([
      base,
      { ...base, title: "3분기 실적 컨센 상회 (목표가 상향)", sourceSite: "hankyung", sourceUrl: "u2", targetPrice: 90000 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].targetPrice).toBe(90000);
    expect(out[0].sourceUrl).toContain("u1");
  });
  it("keeps different brokerages separate", () => {
    const out = dedupeItems([base, { ...base, brokerage: "미래에셋", sourceUrl: "u3" }]);
    expect(out).toHaveLength(2);
  });
});
```

- [ ] **Step 9: Run — verify fail**

Run: `npm test -- lib/normalize.test.ts`
Expected: FAIL (no such module/exports).

- [ ] **Step 10: Implement `lib/normalize.ts`**

```ts
import type { ResearchItem } from "./types";

const BROKERAGE_ALIASES: Record<string, string> = {
  "미래에셋증권": "미래에셋", "삼성증권": "삼성", "KB증권": "KB", "NH투자증권": "NH",
  "한국투자증권": "한국투자", "키움증권": "키움", "신한투자증권": "신한", "하나증권": "하나",
  "대신증권": "대신", "메리츠증권": "메리츠", "유안타증권": "유안타", "교보증권": "교보",
  "IBK투자증권": "IBK", "SK증권": "SK", "현대차증권": "현대차", "DB금융투자": "DB",
  "하이투자증권": "하이", "이베스트투자증권": "이베스트", "다올투자증권": "다올",
  "유진투자증권": "유진", "BNK투자증권": "BNK", "상상인증권": "상상인",
};

export function normalizeStock(name: string): string {
  return name.replace(/\(\d{4,6}\)\s*$/, "").replace(/\s+/g, "").trim();
}

export function normalizeBrokerage(name: string): string {
  const t = name.replace(/\s+/g, " ").trim();
  return BROKERAGE_ALIASES[t] ?? t;
}

function titleKey(title: string): string {
  return title.replace(/[\s()[\]{}·,.:;~\-—]/g, "").toLowerCase();
}

export function dedupeItems(items: ResearchItem[]): ResearchItem[] {
  const groups = new Map<string, ResearchItem>();
  for (const it of items) {
    const k = titleKey(it.title);
    // find an existing item with same stock+brokerage whose title key is a prefix/suffix of this one
    let mergedKey: string | null = null;
    for (const [gk, g] of groups) {
      if (g.stock !== it.stock || g.brokerage !== it.brokerage) continue;
      const a = titleKey(g.title);
      if (a === k || a.includes(k) || k.includes(a)) { mergedKey = gk; break; }
    }
    if (mergedKey) {
      const g = groups.get(mergedKey)!;
      groups.set(mergedKey, {
        ...g,
        title: g.title.length >= it.title.length ? g.title : it.title,
        targetPrice: g.targetPrice ?? it.targetPrice,
        opinion: g.opinion ?? it.opinion,
        sourceUrl: g.sourceUrl.includes(it.sourceUrl) ? g.sourceUrl : `${g.sourceUrl} ${it.sourceUrl}`,
      });
    } else {
      groups.set(`${it.stock}|${it.brokerage}|${k}|${groups.size}`, { ...it });
    }
  }
  return [...groups.values()];
}
```

- [ ] **Step 11: Run — verify pass**

Run: `npm test`
Expected: PASS (dates + normalize suites green).

- [ ] **Step 12: Commit**

```
git add -A
git commit -m "feat: scaffold Next.js app + shared types, date and normalize helpers"
```

---

## Task 2: Naver Finance research parser

**Files:**
- Create: `lib/sources/naver.ts`
- Create: `lib/sources/fixtures/naver-company.html`, `naver-industry.html`, `naver-market.html` (saved real pages)
- Test: `lib/sources/naver.test.ts`

**Interfaces:**
- Consumes: `ResearchItem`, `ResearchKind` from `lib/types.ts`; `parseLooseKoreanDate` from `lib/dates.ts`; `normalizeStock`, `normalizeBrokerage` from `lib/normalize.ts`.
- Produces:
  ```ts
  export function parseNaverList(html: string, kind: ResearchKind): ResearchItem[];
  export async function fetchNaverResearch(fetchImpl?: typeof fetch): Promise<ResearchItem[]>;
  ```
  `fetchNaverResearch` fetches the three list pages, calls `parseNaverList` for each, concatenates. On a per-page fetch/parse error it skips that page (does not throw).

- [ ] **Step 1: Save fixtures from the live site**

Run (PowerShell; the User-Agent header matters — Naver blocks bare clients):
```
$ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
$enc = [System.Text.Encoding]::GetEncoding(949)  # Naver research pages are EUC-KR
function Save-Naver($url, $path) {
  $r = Invoke-WebRequest -Uri $url -Headers @{ "User-Agent" = $ua } -UseBasicParsing
  [System.IO.File]::WriteAllText($path, $enc.GetString($r.RawContentStream.ToArray()), [System.Text.Encoding]::UTF8)
}
Save-Naver "https://finance.naver.com/research/company_list.naver"     "lib/sources/fixtures/naver-company.html"
Save-Naver "https://finance.naver.com/research/industry_list.naver"    "lib/sources/fixtures/naver-industry.html"
Save-Naver "https://finance.naver.com/research/market_info_list.naver" "lib/sources/fixtures/naver-market.html"
```
Open `lib/sources/fixtures/naver-company.html` and confirm the list is a `<table class="type_1">` whose data rows contain, in order: 종목명 (`<a href="company_read...">`), 제목 (`<a href="company_read...">`), 증권사, 첨부(pdf icon), 작성일 (e.g. `26.09.03`), 조회수. Note the first 2 real data rows' 종목명 / 제목 / 증권사 / 작성일 — you will assert them in Step 2. (If the markup differs from this description, adjust the selectors in Step 4 to match what you see; the fixture is ground truth.)

- [ ] **Step 2: Write the failing test**

Create `lib/sources/naver.test.ts` (replace the `EXPECT_*` placeholders with the real values you read in Step 1):
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseNaverList } from "./naver";

const fx = (n: string) => readFileSync(join(__dirname, "fixtures", n), "utf8");

describe("parseNaverList - company", () => {
  const items = parseNaverList(fx("naver-company.html"), "company");
  it("returns a non-trivial number of rows", () => expect(items.length).toBeGreaterThan(10));
  it("parses the first row fields", () => {
    expect(items[0].stock).toBe("EXPECT_STOCK_0");
    expect(items[0].title).toContain("EXPECT_TITLE_SUBSTR_0");
    expect(items[0].brokerage).toBe("EXPECT_BROKERAGE_0"); // normalized (e.g. "삼성")
    expect(items[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(items[0].kind).toBe("company");
    expect(items[0].sourceSite).toBe("naver");
    expect(items[0].sourceUrl).toMatch(/^https:\/\/finance\.naver\.com\/research\//);
  });
  it("every item has stock, title, brokerage, date", () => {
    for (const it of items) {
      expect(it.stock).not.toBe("");
      expect(it.title).not.toBe("");
      expect(it.brokerage).not.toBe("");
      expect(it.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("parseNaverList - industry & market", () => {
  it("industry rows have kind=industry", () => {
    const items = parseNaverList(fx("naver-industry.html"), "industry");
    expect(items.length).toBeGreaterThan(5);
    expect(items.every((i) => i.kind === "industry")).toBe(true);
  });
  it("market rows have kind=market and a brokerage", () => {
    const items = parseNaverList(fx("naver-market.html"), "market");
    expect(items.length).toBeGreaterThan(3);
    expect(items.every((i) => i.kind === "market" && i.brokerage !== "")).toBe(true);
  });
});
```

- [ ] **Step 3: Run — verify fail**

Run: `npm test -- lib/sources/naver.test.ts`
Expected: FAIL (`parseNaverList` not defined).

- [ ] **Step 4: Implement `lib/sources/naver.ts`**

```ts
import * as cheerio from "cheerio";
import type { ResearchItem, ResearchKind } from "@/lib/types";
import { parseLooseKoreanDate } from "@/lib/dates";
import { normalizeStock, normalizeBrokerage } from "@/lib/normalize";

const BASE = "https://finance.naver.com/research/";
const PAGES: Record<ResearchKind, string> = {
  company: "company_list.naver",
  industry: "industry_list.naver",
  market: "market_info_list.naver",
};

export function parseNaverList(html: string, kind: ResearchKind): ResearchItem[] {
  const $ = cheerio.load(html);
  const out: ResearchItem[] = [];
  $("table.type_1 tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 4) return; // header / spacer rows
    const links = $(tr).find("a");
    let stock = "";
    let title = "";
    let href = "";
    if (kind === "company") {
      stock = normalizeStock($(links.get(0)).text().trim());
      title = $(links.get(1)).text().trim();
      href = $(links.get(1)).attr("href") ?? "";
    } else {
      // industry / market: first cell is the title, no per-stock link
      const cells = tds.toArray().map((td) => $(td).text().trim());
      title = $(links.get(0)).text().trim() || cells[0];
      href = $(links.get(0)).attr("href") ?? "";
      stock = kind === "industry" ? (cells[0] && cells[0] !== title ? cells[0] : title) : title;
    }
    if (!title) return;
    const cellTexts = tds.toArray().map((td) => $(td).text().trim());
    const brokerageRaw = cellTexts.find((t) => /증권|투자|금융투자|자산운용/.test(t)) ?? "";
    const dateRaw = cellTexts.find((t) => /^\d{2,4}[.\-/]\d{1,2}[.\-/]\d{1,2}$/.test(t)) ?? "";
    const date = parseLooseKoreanDate(dateRaw);
    if (!date || !brokerageRaw) return;
    out.push({
      stock: stock || title,
      title,
      brokerage: normalizeBrokerage(brokerageRaw),
      date,
      sourceSite: "naver",
      sourceUrl: href.startsWith("http") ? href : BASE + href.replace(/^\//, ""),
      kind,
    });
  });
  return out;
}

export async function fetchNaverResearch(fetchImpl: typeof fetch = fetch): Promise<ResearchItem[]> {
  const kinds: ResearchKind[] = ["company", "industry", "market"];
  const results = await Promise.all(
    kinds.map(async (kind) => {
      try {
        const res = await fetchImpl(BASE + PAGES[kind], {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; NewsletterBot/1.0)" },
        });
        if (!res.ok) return [];
        const buf = await res.arrayBuffer();
        const html = new TextDecoder("euc-kr").decode(buf);
        return parseNaverList(html, kind);
      } catch {
        return [];
      }
    }),
  );
  return results.flat();
}
```

- [ ] **Step 5: Run — verify pass**

Run: `npm test -- lib/sources/naver.test.ts`
Expected: PASS. If a selector assertion fails, inspect the fixture and adjust selectors in `parseNaverList` (not the test's structural assertions) until green.

- [ ] **Step 6: Commit**

```
git add -A
git commit -m "feat: parse Naver Finance research list pages"
```

---

## Task 3: Hankyung Consensus parser

**Files:**
- Create: `lib/sources/hankyung.ts`
- Create: `lib/sources/fixtures/hankyung.html`
- Test: `lib/sources/hankyung.test.ts`

**Interfaces:**
- Consumes: `ResearchItem` from `lib/types.ts`; `parseLooseKoreanDate` from `lib/dates.ts`; `normalizeStock`, `normalizeBrokerage` from `lib/normalize.ts`.
- Produces:
  ```ts
  export function parseHankyungList(html: string): ResearchItem[];
  export async function fetchHankyungConsensus(fetchImpl?: typeof fetch): Promise<ResearchItem[]>;
  ```
  Each parsed row carries `kind`: report-type "기업" → `"company"`, "산업" → `"industry"`, "시장/시황/경제/채권/파생" → `"market"`. `targetPrice` and `opinion` populated when the row has those columns.

- [ ] **Step 1: Save the fixture**

Run (PowerShell):
```
$ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
$r = Invoke-WebRequest -Uri "https://consensus.hankyung.com/analysis/list?skinType=business" -Headers @{ "User-Agent" = $ua } -UseBasicParsing
[System.IO.File]::WriteAllText("lib/sources/fixtures/hankyung.html", $r.Content, [System.Text.Encoding]::UTF8)
```
Open the fixture. Confirm the list is a `<table>` (class likely `table_style01` or inside `div.table_style`) with columns roughly: 작성일 | 분류(리포트구분) | 제목(`<a>`) | 적정가격(목표가) | 투자의견 | 제공출처(증권사) | 첨부. Record the first 2 data rows' 제목 / 증권사 / 목표가 / 분류 / 작성일 for Step 2. If Hankyung serves the list via a JSON/AJAX endpoint instead of server-rendered rows, note the endpoint URL from the browser Network tab and parse JSON instead — keep the exported function signatures identical.

- [ ] **Step 2: Write the failing test**

Create `lib/sources/hankyung.test.ts` (fill real expected values from Step 1):
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseHankyungList } from "./hankyung";

const html = readFileSync(join(__dirname, "fixtures", "hankyung.html"), "utf8");

describe("parseHankyungList", () => {
  const items = parseHankyungList(html);
  it("returns rows", () => expect(items.length).toBeGreaterThan(5));
  it("first row core fields", () => {
    expect(items[0].title).toContain("EXPECT_TITLE_SUBSTR_0");
    expect(items[0].brokerage).toBe("EXPECT_BROKERAGE_0");
    expect(items[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(items[0].sourceSite).toBe("hankyung");
    expect(["company", "industry", "market"]).toContain(items[0].kind);
  });
  it("captures targetPrice when present as a number", () => {
    const withTp = items.find((i) => i.targetPrice !== undefined);
    if (withTp) expect(typeof withTp.targetPrice).toBe("number");
  });
  it("every item has title, brokerage, date", () => {
    for (const it of items) {
      expect(it.title).not.toBe("");
      expect(it.brokerage).not.toBe("");
      expect(it.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
```

- [ ] **Step 3: Run — verify fail**

Run: `npm test -- lib/sources/hankyung.test.ts`
Expected: FAIL (`parseHankyungList` not defined).

- [ ] **Step 4: Implement `lib/sources/hankyung.ts`**

```ts
import * as cheerio from "cheerio";
import type { ResearchItem, ResearchKind } from "@/lib/types";
import { parseLooseKoreanDate } from "@/lib/dates";
import { normalizeStock, normalizeBrokerage } from "@/lib/normalize";

const BASE = "https://consensus.hankyung.com";
const LIST_URL = `${BASE}/analysis/list?skinType=business`;

function kindOf(category: string): ResearchKind {
  if (/기업|종목/.test(category)) return "company";
  if (/산업|업종/.test(category)) return "industry";
  return "market"; // 시장/시황/경제/채권/파생/기타
}

function toNumber(raw: string): number | undefined {
  const n = Number(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function parseHankyungList(html: string): ResearchItem[] {
  const $ = cheerio.load(html);
  const out: ResearchItem[] = [];
  $("table tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 5) return;
    const cells = tds.toArray().map((td) => $(td).text().trim());
    const titleAnchor = $(tr).find("a").first();
    const title = titleAnchor.text().trim();
    if (!title) return;
    const href = titleAnchor.attr("href") ?? "";
    const dateRaw = cells.find((t) => /^\d{2,4}[.\-/]\d{1,2}[.\-/]\d{1,2}$/.test(t)) ?? "";
    const date = parseLooseKoreanDate(dateRaw);
    if (!date) return;
    const brokerageRaw = cells.find((t) => /증권|투자|금융투자/.test(t)) ?? "";
    if (!brokerageRaw) return;
    const category = cells[1] ?? "";
    const opinion = cells.find((t) => /매수|매도|중립|보유|Buy|Hold|Sell|Outperform/i.test(t));
    const tpCell = cells.find((t) => /^[\d,]+$/.test(t) && t.length >= 4);
    out.push({
      stock: normalizeStock(title.split(/[\s(]/)[0]),
      title,
      brokerage: normalizeBrokerage(brokerageRaw),
      targetPrice: tpCell ? toNumber(tpCell) : undefined,
      opinion: opinion || undefined,
      date,
      sourceSite: "hankyung",
      sourceUrl: href.startsWith("http") ? href : BASE + (href.startsWith("/") ? href : `/${href}`),
      kind: kindOf(category),
    });
  });
  return out;
}

export async function fetchHankyungConsensus(fetchImpl: typeof fetch = fetch): Promise<ResearchItem[]> {
  try {
    const res = await fetchImpl(LIST_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NewsletterBot/1.0)" },
    });
    if (!res.ok) return [];
    return parseHankyungList(await res.text());
  } catch {
    return [];
  }
}
```

- [ ] **Step 5: Run — verify pass**

Run: `npm test -- lib/sources/hankyung.test.ts`
Expected: PASS. Adjust selectors / cell heuristics against the fixture until green. For `stock`, Hankyung titles usually start with the company name (e.g. `삼성전자: 3분기 …`) — the `title.split(/[\s(]/)[0]` heuristic covers the common case; refine if the fixture shows a dedicated 종목 column.

- [ ] **Step 6: Commit**

```
git add -A
git commit -m "feat: parse Hankyung Consensus research list"
```

---

## Task 4: `/api/collect` server route

**Files:**
- Create: `app/api/collect/route.ts`
- Test: `app/api/collect/route.test.ts`

**Interfaces:**
- Consumes: `fetchNaverResearch` (`lib/sources/naver.ts`), `fetchHankyungConsensus` (`lib/sources/hankyung.ts`), `dedupeItems` (`lib/normalize.ts`), `isRecentKST` (`lib/dates.ts`), `CollectionResult` (`lib/types.ts`).
- Produces: `GET` handler returning `CollectionResult` as JSON. Also exports a testable pure core:
  ```ts
  export async function collect(deps: {
    naver: () => Promise<ResearchItem[]>;
    hankyung: () => Promise<ResearchItem[]>;
    now?: Date;
  }): Promise<CollectionResult>;
  ```
  Rules: run both in parallel; a source that throws OR returns `[]` is added to `failures`; merge, `dedupeItems`, keep only `isRecentKST(item.date, now)`, sort by `date` desc.

- [ ] **Step 1: Write the failing test**

Create `app/api/collect/route.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { collect } from "./route";
import type { ResearchItem } from "@/lib/types";

const NOW = new Date("2026-09-03T00:00:00Z"); // 09:00 KST
const mk = (o: Partial<ResearchItem>): ResearchItem => ({
  stock: "삼성전자", title: "t", brokerage: "삼성", date: "2026-09-03",
  sourceSite: "naver", sourceUrl: "u", kind: "company", ...o,
});

describe("collect", () => {
  it("merges sources, dedupes, and drops stale items", async () => {
    const r = await collect({
      now: NOW,
      naver: async () => [mk({}), mk({ date: "2026-08-01", sourceUrl: "old" })],
      hankyung: async () => [mk({ sourceSite: "hankyung", sourceUrl: "u2", targetPrice: 90000 })],
    });
    expect(r.items).toHaveLength(1);
    expect(r.items[0].targetPrice).toBe(90000);
    expect(r.failures).toEqual([]);
  });

  it("records a source that throws as a failure but still returns the other", async () => {
    const r = await collect({
      now: NOW,
      naver: async () => { throw new Error("boom"); },
      hankyung: async () => [mk({ sourceSite: "hankyung" })],
    });
    expect(r.failures).toEqual(["naver"]);
    expect(r.items).toHaveLength(1);
  });

  it("records an empty source as a failure", async () => {
    const r = await collect({ now: NOW, naver: async () => [], hankyung: async () => [] });
    expect(r.failures.sort()).toEqual(["hankyung", "naver"]);
    expect(r.items).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npm test -- app/api/collect/route.test.ts`
Expected: FAIL (`./route` has no `collect`).

- [ ] **Step 3: Implement `app/api/collect/route.ts`**

```ts
import { NextResponse } from "next/server";
import type { CollectionResult, ResearchItem, SourceSite } from "@/lib/types";
import { fetchNaverResearch } from "@/lib/sources/naver";
import { fetchHankyungConsensus } from "@/lib/sources/hankyung";
import { dedupeItems } from "@/lib/normalize";
import { isRecentKST } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function collect(deps: {
  naver: () => Promise<ResearchItem[]>;
  hankyung: () => Promise<ResearchItem[]>;
  now?: Date;
}): Promise<CollectionResult> {
  const now = deps.now ?? new Date();
  const sources: [SourceSite, () => Promise<ResearchItem[]>][] = [
    ["naver", deps.naver],
    ["hankyung", deps.hankyung],
  ];
  const failures: SourceSite[] = [];
  const gathered: ResearchItem[] = [];
  await Promise.all(
    sources.map(async ([name, fn]) => {
      try {
        const items = await fn();
        if (items.length === 0) failures.push(name);
        else gathered.push(...items);
      } catch {
        failures.push(name);
      }
    }),
  );
  const items = dedupeItems(gathered)
    .filter((it) => isRecentKST(it.date, now))
    .sort((a, b) => b.date.localeCompare(a.date));
  return { collectedAt: now.toISOString(), items, failures };
}

export async function GET() {
  const result = await collect({ naver: fetchNaverResearch, hankyung: fetchHankyungConsensus });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npm test -- app/api/collect/route.test.ts`
Expected: PASS (3).

- [ ] **Step 5: Manual smoke test against the live sites**

Run: `npm run dev`, then in another terminal:
```
curl "http://localhost:3000/api/collect"
```
Expected: JSON with `"items"` non-empty and `"failures": []` on a weekday morning. If a source is in `failures`, re-open its fixture/selectors from Task 2/3. Stop `next dev` when done.

- [ ] **Step 6: Commit**

```
git add -A
git commit -m "feat: /api/collect route merges, dedupes, and date-filters sources"
```

---

## Task 5: Rule-based recommendation engine

**Files:**
- Create: `lib/recommend.ts`
- Test: `lib/recommend.test.ts`

**Interfaces:**
- Consumes: `ResearchItem`, `RecItem`, `RecTag` from `lib/types.ts`; `normalizeStock` from `lib/normalize.ts`.
- Produces:
  ```ts
  export interface RecommendInput {
    items: ResearchItem[];
    watchlist: string[];                 // raw user strings; normalized internally
    chatroomStocks: string[];            // from lib/kakaoParse.ts (Task 6)
    prevTargetPrices?: Record<string, number>; // normalized stock -> prior targetPrice
  }
  export interface RecommendOutput {
    company: RecItem[];   // sorted, includes hidden:true entries
    industry: RecItem[];  // informational, threshold not applied
    market: ResearchItem[]; // raw market/시황 items, newest first
  }
  export function recommend(input: RecommendInput): RecommendOutput;
  ```
  Sort order for `company`: watchlist first, then `mentionCount` desc, then `stock` asc. `score` = `(isWatchlist?1000:0) + mentionCount*10 + (tags.includes("target-up")||tags.includes("target-down")?5:0) + (tags.includes("new-coverage")?3:0)`.
  `hidden` = `mentionCount < 2 && !isWatchlist && tags has none of target-up/target-down/new-coverage/chatroom`.
  `leadComment`: prefer an item whose title matches `/상향|하향|목표가/`, else the newest item's title. `leadBrokerage`: that item's brokerage.
  Tags: `target-up` if any title matches `/상향|올려|상승 여력|목표가.*(상향|↑)/`; `target-down` if any matches `/하향|내려|목표가.*(하향|↓)/`; `new-coverage` if any matches `/커버리지 (개시|재개)|신규 편입|Initiate|Initiation/i`; `watchlist` if normalized stock ∈ normalized watchlist; `chatroom` if normalized stock ∈ normalized chatroomStocks.
  `targetPriceChangePct`: if `prevTargetPrices[stock]` and a current item has `targetPrice`, `round(((cur - prev)/prev)*100)`.

- [ ] **Step 1: Write the failing test**

Create `lib/recommend.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { recommend } from "./recommend";
import type { ResearchItem } from "./types";

const mk = (o: Partial<ResearchItem>): ResearchItem => ({
  stock: "삼성전자", title: "3분기 실적 리뷰", brokerage: "삼성",
  date: "2026-09-03", sourceSite: "naver", sourceUrl: "u", kind: "company", ...o,
});

describe("recommend", () => {
  it("includes a stock mentioned by >=2 distinct brokerages, not hidden", () => {
    const out = recommend({
      items: [mk({ brokerage: "삼성" }), mk({ brokerage: "미래에셋" }), mk({ brokerage: "KB" })],
      watchlist: [], chatroomStocks: [],
    });
    expect(out.company).toHaveLength(1);
    expect(out.company[0].mentionCount).toBe(3);
    expect(out.company[0].hidden).toBe(false);
  });

  it("hides a single-brokerage stock with no special tags", () => {
    const out = recommend({ items: [mk({ brokerage: "삼성" })], watchlist: [], chatroomStocks: [] });
    expect(out.company[0].hidden).toBe(true);
  });

  it("puts a watchlist stock first, never hidden, with the tag", () => {
    const out = recommend({
      items: [
        mk({ stock: "한화에어로스페이스", brokerage: "삼성" }),
        mk({ stock: "삼성전자", brokerage: "삼성" }),
        mk({ stock: "삼성전자", brokerage: "NH" }),
      ],
      watchlist: ["한화에어로스페이스"], chatroomStocks: [],
    });
    expect(out.company[0].stock).toBe("한화에어로스페이스");
    expect(out.company[0].hidden).toBe(false);
    expect(out.company[0].tags).toContain("watchlist");
  });

  it("tags target-up from a title keyword and picks it as lead comment", () => {
    const out = recommend({
      items: [mk({ brokerage: "삼성", title: "메모리 업턴, 목표가 상향" }), mk({ brokerage: "NH", title: "3분기 프리뷰" })],
      watchlist: [], chatroomStocks: [],
    });
    expect(out.company[0].tags).toContain("target-up");
    expect(out.company[0].leadComment).toBe("메모리 업턴, 목표가 상향");
  });

  it("computes targetPriceChangePct from prevTargetPrices", () => {
    const out = recommend({
      items: [mk({ brokerage: "삼성", targetPrice: 110000 }), mk({ brokerage: "NH" })],
      watchlist: [], chatroomStocks: [], prevTargetPrices: { 삼성전자: 100000 },
    });
    expect(out.company[0].targetPriceChangePct).toBe(10);
  });

  it("tags chatroom and keeps the item visible even with one brokerage", () => {
    const out = recommend({
      items: [mk({ stock: "에코프로", brokerage: "삼성" })],
      watchlist: [], chatroomStocks: ["에코프로"],
    });
    expect(out.company[0].tags).toContain("chatroom");
    expect(out.company[0].hidden).toBe(false);
  });

  it("separates industry and market items", () => {
    const out = recommend({
      items: [
        mk({ kind: "industry", stock: "반도체", brokerage: "삼성" }),
        mk({ kind: "market", title: "외국인 수급 점검", brokerage: "대신" }),
      ],
      watchlist: [], chatroomStocks: [],
    });
    expect(out.industry).toHaveLength(1);
    expect(out.market).toHaveLength(1);
    expect(out.company).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npm test -- lib/recommend.test.ts`
Expected: FAIL (`recommend` not defined).

- [ ] **Step 3: Implement `lib/recommend.ts`**

```ts
import type { ResearchItem, RecItem, RecTag } from "./types";
import { normalizeStock } from "./normalize";

export interface RecommendInput {
  items: ResearchItem[];
  watchlist: string[];
  chatroomStocks: string[];
  prevTargetPrices?: Record<string, number>;
}
export interface RecommendOutput {
  company: RecItem[];
  industry: RecItem[];
  market: ResearchItem[];
}

const RE_UP = /상향|올려|상승\s*여력|목표가.*(상향|↑)/;
const RE_DOWN = /하향|내려|목표가.*(하향|↓)/;
const RE_NEW = /커버리지\s*(개시|재개)|신규\s*편입|Initiat(e|ion)/i;

function groupByStock(items: ResearchItem[]): Map<string, ResearchItem[]> {
  const m = new Map<string, ResearchItem[]>();
  for (const it of items) {
    const key = normalizeStock(it.stock);
    (m.get(key) ?? m.set(key, []).get(key)!).push(it);
  }
  return m;
}

function buildRec(
  stock: string,
  items: ResearchItem[],
  watch: Set<string>,
  chat: Set<string>,
  prev: Record<string, number>,
): RecItem {
  const brokerages = [...new Set(items.map((i) => i.brokerage))];
  const mentionCount = brokerages.length;
  const isWatchlist = watch.has(stock);
  const tags: RecTag[] = [];
  const anyTitle = items.map((i) => i.title).join(" | ");
  if (RE_UP.test(anyTitle)) tags.push("target-up");
  if (RE_DOWN.test(anyTitle)) tags.push("target-down");
  if (RE_NEW.test(anyTitle)) tags.push("new-coverage");
  if (isWatchlist) tags.push("watchlist");
  if (chat.has(stock)) tags.push("chatroom");

  const byNewest = [...items].sort((a, b) => b.date.localeCompare(a.date));
  const lead = byNewest.find((i) => /상향|하향|목표가/.test(i.title)) ?? byNewest[0];

  const prevTp = prev[stock];
  const curTp = items.find((i) => typeof i.targetPrice === "number")?.targetPrice;
  const targetPriceChangePct =
    prevTp && curTp ? Math.round(((curTp - prevTp) / prevTp) * 100) : undefined;

  const special = tags.some((t) => t === "target-up" || t === "target-down" || t === "new-coverage" || t === "chatroom");
  const hidden = mentionCount < 2 && !isWatchlist && !special;
  const score =
    (isWatchlist ? 1000 : 0) +
    mentionCount * 10 +
    (tags.includes("target-up") || tags.includes("target-down") ? 5 : 0) +
    (tags.includes("new-coverage") ? 3 : 0);

  return {
    stock, mentionCount, brokerages, items: byNewest,
    leadComment: lead.title, leadBrokerage: lead.brokerage,
    tags, targetPriceChangePct, isWatchlist, hidden, score,
  };
}

export function recommend(input: RecommendInput): RecommendOutput {
  const watch = new Set(input.watchlist.map(normalizeStock));
  const chat = new Set(input.chatroomStocks.map(normalizeStock));
  const prev = input.prevTargetPrices ?? {};

  const company = [...groupByStock(input.items.filter((i) => i.kind === "company"))]
    .map(([stock, items]) => buildRec(stock, items, watch, chat, prev))
    .sort(
      (a, b) =>
        Number(b.isWatchlist) - Number(a.isWatchlist) ||
        b.mentionCount - a.mentionCount ||
        a.stock.localeCompare(b.stock),
    );

  const industry = [...groupByStock(input.items.filter((i) => i.kind === "industry"))]
    .map(([stock, items]) => buildRec(stock, items, watch, chat, prev))
    .sort((a, b) => b.mentionCount - a.mentionCount || a.stock.localeCompare(b.stock));

  const market = input.items
    .filter((i) => i.kind === "market")
    .sort((a, b) => b.date.localeCompare(a.date));

  return { company, industry, market };
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npm test -- lib/recommend.test.ts`
Expected: PASS (7).

- [ ] **Step 5: Commit**

```
git add -A
git commit -m "feat: rule-based recommendation engine (mentions + watchlist + tags)"
```

---

## Task 6: Chat-room text parser + stock dictionary

**Files:**
- Create: `lib/stockDictionary.ts`
- Create: `lib/kakaoParse.ts`
- Test: `lib/kakaoParse.test.ts`

**Interfaces:**
- Consumes: `normalizeStock` from `lib/normalize.ts`.
- Produces:
  ```ts
  // lib/stockDictionary.ts
  export const BASE_STOCKS: string[]; // major KOSPI/KOSDAQ + major US names in Korean
  // lib/kakaoParse.ts
  export function parseChatroom(text: string, extraDictionary?: string[]): {
    matchedStocks: string[];  // normalized, de-duplicated, in first-seen order
    rawText: string;          // original text, trimmed
  };
  ```
  Matching: a dictionary entry matches if its normalized form is a substring of the normalized input text. `extraDictionary` (collected stocks + watchlist) is merged with `BASE_STOCKS`. Entries shorter than 2 chars are ignored.

- [ ] **Step 1: Create `lib/stockDictionary.ts`**

```ts
// Bundled supplement. The live dictionary is mostly (collected items + watchlist);
// this list only helps catch stocks the chat-room mentions that aren't in today's research.
// Expand freely over time.
export const BASE_STOCKS: string[] = [
  "삼성전자", "SK하이닉스", "LG에너지솔루션", "삼성바이오로직스", "현대차", "기아",
  "셀트리온", "POSCO홀딩스", "NAVER", "카카오", "삼성SDI", "LG화학", "현대모비스",
  "삼성물산", "KB금융", "신한지주", "하나금융지주", "메리츠금융지주", "포스코퓨처엠",
  "HD한국조선해양", "HD현대일렉트릭", "한화에어로스페이스", "한화오션", "두산에너빌리티",
  "삼성중공업", "에코프로", "에코프로비엠", "포스코인터내셔널", "LG전자", "SK이노베이션",
  "SK스퀘어", "크래프톤", "엔씨소프트", "넷마블", "펄어비스", "하이브", "JYP Ent.",
  "에스엠", "CJ제일제당", "오리온", "농심", "KT&G", "아모레퍼시픽", "LG생활건강",
  "코스맥스", "한국콜마", "유한양행", "한미약품", "대웅제약", "SK바이오팜", "알테오젠",
  "리가켐바이오", "펩트론", "HLB", "삼천당제약", "클래시스", "파마리서치", "휴젤",
  "현대로템", "LIG넥스원", "한국항공우주", "삼양식품", "F&F", "더존비즈온", "리노공업",
  "이오테크닉스", "주성엔지니어링", "원익IPS", "solbrain", "동진쎄미켐", "티씨케이",
  "덕산네오룩스", "레인보우로보틱스", "두산로보틱스", "한화시스템",
  // 미국 (한글 표기)
  "엔비디아", "애플", "마이크로소프트", "테슬라", "아마존", "알파벳", "구글", "메타",
  "브로드컴", "AMD", "마이크론", "팔란티어", "넷플릭스", "TSMC", "ASML", "일라이릴리",
];
```

- [ ] **Step 2: Write the failing test**

Create `lib/kakaoParse.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseChatroom } from "./kakaoParse";

describe("parseChatroom", () => {
  it("finds base-dictionary stocks mentioned in free text", () => {
    const r = parseChatroom("오늘 삼성전자랑 SK하이닉스 강하네요. 엔비디아 실적도 체크");
    expect(r.matchedStocks).toEqual(["삼성전자", "SK하이닉스", "엔비디아"]);
  });

  it("uses the extra dictionary (today's collected names + watchlist)", () => {
    const r = parseChatroom("제노스코 관련 코멘트 나왔어요", ["제노스코"]);
    expect(r.matchedStocks).toEqual(["제노스코"]);
  });

  it("de-duplicates and preserves first-seen order", () => {
    const r = parseChatroom("카카오 카카오 NAVER");
    expect(r.matchedStocks).toEqual(["카카오", "NAVER"]);
  });

  it("returns trimmed rawText and empty matches when nothing matches", () => {
    const r = parseChatroom("  특별한 종목 언급 없음  ");
    expect(r.matchedStocks).toEqual([]);
    expect(r.rawText).toBe("특별한 종목 언급 없음");
  });
});
```

- [ ] **Step 3: Run — verify fail**

Run: `npm test -- lib/kakaoParse.test.ts`
Expected: FAIL (`parseChatroom` not defined).

- [ ] **Step 4: Implement `lib/kakaoParse.ts`**

```ts
import { normalizeStock } from "./normalize";
import { BASE_STOCKS } from "./stockDictionary";

export function parseChatroom(
  text: string,
  extraDictionary: string[] = [],
): { matchedStocks: string[]; rawText: string } {
  const rawText = text.trim();
  const haystack = rawText.replace(/\s+/g, "").toLowerCase();
  const dict = [...new Set([...BASE_STOCKS, ...extraDictionary])]
    .filter((s) => s && normalizeStock(s).length >= 2)
    // longer names first so "삼성바이오로직스" wins before "삼성"
    .sort((a, b) => b.length - a.length);

  const seen = new Set<string>();
  const ordered: { name: string; at: number }[] = [];
  for (const name of dict) {
    const needle = normalizeStock(name).toLowerCase();
    const at = haystack.indexOf(needle);
    if (at >= 0 && !seen.has(normalizeStock(name))) {
      seen.add(normalizeStock(name));
      ordered.push({ name: normalizeStock(name), at });
    }
  }
  ordered.sort((a, b) => a.at - b.at);
  return { matchedStocks: ordered.map((o) => o.name), rawText };
}
```

- [ ] **Step 5: Run — verify pass**

Run: `npm test -- lib/kakaoParse.test.ts`
Expected: PASS (4). Note: the first test expects normalized names; `SK하이닉스`/`NAVER` normalize to themselves (no spaces, no parens), so assertions hold.

- [ ] **Step 6: Commit**

```
git add -A
git commit -m "feat: chat-room stock extraction + bundled stock dictionary"
```

---

## Task 7: Newsletter assembler

**Files:**
- Create: `lib/newsletter.ts`
- Test: `lib/newsletter.test.ts`

**Interfaces:**
- Consumes: `RecItem` from `lib/types.ts`; `ResearchItem` from `lib/types.ts`.
- Produces:
  ```ts
  export interface NewsletterInput {
    dateLabel: string;                 // "2026년 9월 3일"
    company: RecItem[];                // user-selected company recs
    market: ResearchItem[];            // user-selected 시황 items
    chatroomExtra?: { stock: string; note: string }[]; // matched chat-room stocks not in research
    chatroomRaw?: string;              // fallback raw text when nothing matched
  }
  export function buildNewsletter(input: NewsletterInput): string;
  export function brokerageLabel(brokerages: string[]): string; // "삼성·미래에셋·KB 외, 5곳"
  ```
  Sections in fixed order, empty ones omitted: `[목표가·투자의견 변경]` (recs with `target-up`/`target-down`), `[여러 증권사 주목]` (remaining recs with `mentionCount >= 2`), `[시황]` (market items), `[신규 커버리지]` (recs with `new-coverage` and not already placed), `[단톡방 언급]` (chatroomExtra, else chatroomRaw). Each company line: `• {stock} — {leadComment} ({brokerageLabel}, N곳)`; append ` / 목표가 {+/-}{pct}%` when `targetPriceChangePct` present. Market line: `• {title} — {brokerage}`. A rec is placed in exactly one section using the priority: 목표가 변경 > 신규 커버리지 > 여러 증권사 주목. Header line: `📈 오늘의 증권가 브리핑 · {dateLabel}`. Footer: `※ 자료: 네이버 금융 리서치, 한경 컨센서스` preceded by a `────────` rule.

- [ ] **Step 1: Write the failing test**

Create `lib/newsletter.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildNewsletter, brokerageLabel } from "./newsletter";
import type { RecItem, ResearchItem } from "./types";

const rec = (o: Partial<RecItem>): RecItem => ({
  stock: "삼성전자", mentionCount: 3, brokerages: ["삼성", "미래에셋", "NH"],
  items: [], leadComment: "3분기 실적 컨센 상회", leadBrokerage: "삼성",
  tags: [], isWatchlist: false, hidden: false, score: 0, ...o,
});

describe("brokerageLabel", () => {
  it("lists up to 3 then 외, N곳", () =>
    expect(brokerageLabel(["삼성", "미래에셋", "KB", "NH", "하나"])).toBe("삼성·미래에셋·KB 외, 5곳"));
  it("no 외 when 3 or fewer", () =>
    expect(brokerageLabel(["삼성", "NH"])).toBe("삼성·NH, 2곳"));
});

describe("buildNewsletter", () => {
  it("omits empty sections and renders the header/footer", () => {
    const out = buildNewsletter({ dateLabel: "2026년 9월 3일", company: [rec({ mentionCount: 3 })], market: [] });
    expect(out).toContain("📈 오늘의 증권가 브리핑 · 2026년 9월 3일");
    expect(out).toContain("[여러 증권사 주목]");
    expect(out).not.toContain("[목표가·투자의견 변경]");
    expect(out).toContain("• 삼성전자 — 3분기 실적 컨센 상회 (삼성·미래에셋·NH, 3곳)");
    expect(out.trimEnd().endsWith("※ 자료: 네이버 금융 리서치, 한경 컨센서스")).toBe(true);
  });

  it("routes a target-up rec to the 목표가 변경 section with pct", () => {
    const out = buildNewsletter({
      dateLabel: "d", market: [],
      company: [rec({ tags: ["target-up"], targetPriceChangePct: 12 })],
    });
    expect(out).toContain("[목표가·투자의견 변경]");
    expect(out).toContain("/ 목표가 +12%");
    expect(out).not.toContain("[여러 증권사 주목]");
  });

  it("renders market lines and 단톡방 fallback raw text", () => {
    const m: ResearchItem = {
      stock: "시황", title: "외국인 순매수 전환 전망", brokerage: "대신",
      date: "2026-09-03", sourceSite: "naver", sourceUrl: "u", kind: "market",
    };
    const out = buildNewsletter({ dateLabel: "d", company: [], market: [m], chatroomRaw: "장초반 반도체 강세" });
    expect(out).toContain("[시황]\n• 외국인 순매수 전환 전망 — 대신");
    expect(out).toContain("[단톡방 언급]\n• 장초반 반도체 강세");
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npm test -- lib/newsletter.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/newsletter.ts`**

```ts
import type { RecItem, ResearchItem } from "./types";

export function brokerageLabel(brokerages: string[]): string {
  const head = brokerages.slice(0, 3).join("·");
  return brokerages.length > 3 ? `${head} 외, ${brokerages.length}곳` : `${head}, ${brokerages.length}곳`;
}

function companyLine(r: RecItem): string {
  let line = `• ${r.stock} — ${r.leadComment} (${brokerageLabel(r.brokerages)})`;
  if (typeof r.targetPriceChangePct === "number" && r.targetPriceChangePct !== 0) {
    const sign = r.targetPriceChangePct > 0 ? "+" : "";
    line += ` / 목표가 ${sign}${r.targetPriceChangePct}%`;
  }
  return line;
}

export interface NewsletterInput {
  dateLabel: string;
  company: RecItem[];
  market: ResearchItem[];
  chatroomExtra?: { stock: string; note: string }[];
  chatroomRaw?: string;
}

export function buildNewsletter(input: NewsletterInput): string {
  const placed = new Set<RecItem>();
  const take = (pred: (r: RecItem) => boolean) =>
    input.company.filter((r) => !placed.has(r) && pred(r)).map((r) => (placed.add(r), r));

  const targetSec = take((r) => r.tags.includes("target-up") || r.tags.includes("target-down"));
  const newSec = take((r) => r.tags.includes("new-coverage"));
  const multiSec = take((r) => r.mentionCount >= 2);

  const blocks: string[] = [`📈 오늘의 증권가 브리핑 · ${input.dateLabel}`];
  const section = (title: string, lines: string[]) => {
    if (lines.length) blocks.push(`[${title}]\n${lines.join("\n")}`);
  };

  section("목표가·투자의견 변경", targetSec.map(companyLine));
  section("여러 증권사 주목", multiSec.map(companyLine));
  section("시황", input.market.map((m) => `• ${m.title} — ${m.brokerage}`));
  section("신규 커버리지", newSec.map(companyLine));

  const chatLines =
    input.chatroomExtra?.length
      ? input.chatroomExtra.map((c) => `• ${c.stock} — ${c.note}`)
      : input.chatroomRaw?.trim()
        ? [`• ${input.chatroomRaw.trim()}`]
        : [];
  section("단톡방 언급", chatLines);

  blocks.push(`────────\n※ 자료: 네이버 금융 리서치, 한경 컨센서스`);
  return blocks.join("\n\n");
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npm test -- lib/newsletter.test.ts`
Expected: PASS (5).

- [ ] **Step 5: Commit**

```
git add -A
git commit -m "feat: assemble sectioned bullet-format newsletter text"
```

---

## Task 8: `localStorage` helpers

**Files:**
- Create: `lib/storage.ts`
- Test: `lib/storage.test.ts`

**Interfaces:**
- Consumes: `ResearchItem`, `CollectionResult` from `lib/types.ts`; `normalizeStock` from `lib/normalize.ts`.
- Produces:
  ```ts
  export function getWatchlist(): string[];
  export function setWatchlist(list: string[]): void;                 // trims, drops blanks/dupes
  export function saveSnapshot(dateYmd: string, items: ResearchItem[]): void; // also prunes to 14 days
  export function loadPrevTargetPrices(beforeDateYmd: string): Record<string, number>; // newest snapshot strictly before the date
  export function saveCollection(data: CollectionResult): void;
  export function loadCollection(): CollectionResult | null;
  export function saveSelection(stocks: string[]): void;
  export function loadSelection(): string[];
  export function saveMarketSelection(urls: string[]): void;
  export function loadMarketSelection(): string[];
  export function saveDraft(text: string): void;
  export function loadDraft(): string | null;
  ```
  Every function is a no-op / safe-default when `typeof window === "undefined"` or `localStorage` throws (wrap each access in try/catch). Keys are namespaced `snl:` (e.g. `snl:watchlist`, `snl:snapshot:2026-09-03`, `snl:collection`, `snl:selection`, `snl:marketSelection`, `snl:draft`).

- [ ] **Step 1: Write the failing test**

Create `lib/storage.test.ts` (jsdom gives us `localStorage`):
```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  getWatchlist, setWatchlist, saveSnapshot, loadPrevTargetPrices,
  saveSelection, loadSelection, saveDraft, loadDraft,
} from "./storage";
import type { ResearchItem } from "./types";

const mk = (o: Partial<ResearchItem>): ResearchItem => ({
  stock: "삼성전자", title: "t", brokerage: "삼성", date: "2026-09-03",
  sourceSite: "naver", sourceUrl: "u", kind: "company", ...o,
});

beforeEach(() => localStorage.clear());

describe("watchlist", () => {
  it("round-trips, trimming and de-duping", () => {
    setWatchlist([" 삼성전자 ", "삼성전자", "", "SK하이닉스"]);
    expect(getWatchlist()).toEqual(["삼성전자", "SK하이닉스"]);
  });
  it("defaults to [] when unset", () => expect(getWatchlist()).toEqual([]));
});

describe("snapshots", () => {
  it("returns target prices from the newest snapshot before a date", () => {
    saveSnapshot("2026-09-01", [mk({ targetPrice: 90000 })]);
    saveSnapshot("2026-09-02", [mk({ targetPrice: 100000 })]);
    expect(loadPrevTargetPrices("2026-09-03")).toEqual({ 삼성전자: 100000 });
    expect(loadPrevTargetPrices("2026-09-02")).toEqual({ 삼성전자: 90000 });
  });
  it("prunes snapshots older than 14 days", () => {
    saveSnapshot("2026-08-01", [mk({ targetPrice: 1 })]);
    saveSnapshot("2026-09-03", [mk({ targetPrice: 2 })]);
    expect(localStorage.getItem("snl:snapshot:2026-08-01")).toBeNull();
  });
});

describe("selection & draft", () => {
  it("round-trips selection", () => { saveSelection(["삼성전자"]); expect(loadSelection()).toEqual(["삼성전자"]); });
  it("round-trips draft", () => { saveDraft("hello"); expect(loadDraft()).toBe("hello"); });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npm test -- lib/storage.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/storage.ts`**

```ts
import type { ResearchItem, CollectionResult } from "./types";
import { normalizeStock } from "./normalize";

const P = "snl:";
const SNAP_KEEP_DAYS = 14;

function read<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(P + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(P + key, JSON.stringify(value));
  } catch {
    /* quota / privacy mode — ignore */
  }
}
function remove(key: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(P + key);
  } catch {
    /* ignore */
  }
}

export function getWatchlist(): string[] {
  return read<string[]>("watchlist", []);
}
export function setWatchlist(list: string[]): void {
  const clean: string[] = [];
  for (const raw of list) {
    const v = raw.trim();
    if (v && !clean.includes(v)) clean.push(v);
  }
  write("watchlist", clean);
}

function snapshotDates(): string[] {
  const out: string[] = [];
  try {
    if (typeof window === "undefined") return out;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(P + "snapshot:")) out.push(k.slice((P + "snapshot:").length));
    }
  } catch {
    /* ignore */
  }
  return out.sort();
}

export function saveSnapshot(dateYmd: string, items: ResearchItem[]): void {
  const map: Record<string, number> = {};
  for (const it of items) {
    if (typeof it.targetPrice === "number") map[normalizeStock(it.stock)] = it.targetPrice;
  }
  write(`snapshot:${dateYmd}`, map);
  const cutoff = new Date(dateYmd);
  cutoff.setDate(cutoff.getDate() - SNAP_KEEP_DAYS);
  const cutoffYmd = cutoff.toISOString().slice(0, 10);
  for (const d of snapshotDates()) if (d < cutoffYmd) remove(`snapshot:${d}`);
}

export function loadPrevTargetPrices(beforeDateYmd: string): Record<string, number> {
  const candidates = snapshotDates().filter((d) => d < beforeDateYmd);
  if (!candidates.length) return {};
  return read<Record<string, number>>(`snapshot:${candidates[candidates.length - 1]}`, {});
}

export function saveCollection(data: CollectionResult): void {
  write("collection", data);
}
export function loadCollection(): CollectionResult | null {
  return read<CollectionResult | null>("collection", null);
}
export function saveSelection(stocks: string[]): void {
  write("selection", stocks);
}
export function loadSelection(): string[] {
  return read<string[]>("selection", []);
}
export function saveMarketSelection(urls: string[]): void {
  write("marketSelection", urls);
}
export function loadMarketSelection(): string[] {
  return read<string[]>("marketSelection", []);
}
export function saveDraft(text: string): void {
  write("draft", text);
}
export function loadDraft(): string | null {
  return read<string | null>("draft", null);
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npm test -- lib/storage.test.ts`
Expected: PASS (7).

- [ ] **Step 5: Commit**

```
git add -A
git commit -m "feat: localStorage helpers for watchlist, snapshots, selection, draft"
```

---

## Task 9: App shell — bottom nav, layout, manifest

**Files:**
- Create: `components/BottomNav.tsx`
- Modify: `app/layout.tsx` (add nav + manifest link + global styles)
- Create: `app/newsletter/page.tsx` (placeholder), `app/watchlist/page.tsx` (placeholder)
- Create: `public/manifest.webmanifest`
- Create: `app/globals.css`
- Test: `components/BottomNav.test.tsx`

**Interfaces:**
- Consumes: nothing from prior tasks (uses `next/link`, `next/navigation`).
- Produces: `export default function BottomNav()` — renders three `next/link`s to `/`, `/newsletter`, `/watchlist` with labels `추천` / `뉴스레터` / `관심종목`; the link matching the current pathname gets `aria-current="page"`.

- [ ] **Step 1: Write the failing test**

Create `components/BottomNav.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BottomNav from "./BottomNav";

vi.mock("next/navigation", () => ({ usePathname: () => "/newsletter" }));

describe("BottomNav", () => {
  it("renders the three tabs", () => {
    render(<BottomNav />);
    expect(screen.getByRole ? screen.getByText("추천") : screen.getByText("추천")).toBeInTheDocument();
    expect(screen.getByText("뉴스레터")).toBeInTheDocument();
    expect(screen.getByText("관심종목")).toBeInTheDocument();
  });
  it("marks the active tab with aria-current", () => {
    render(<BottomNav />);
    expect(screen.getByText("뉴스레터").closest("a")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("추천").closest("a")).not.toHaveAttribute("aria-current");
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npm test -- components/BottomNav.test.tsx`
Expected: FAIL (`./BottomNav` not found).

- [ ] **Step 3: Implement `components/BottomNav.tsx`**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "추천" },
  { href: "/newsletter", label: "뉴스레터" },
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
```

- [ ] **Step 4: Run — verify pass**

Run: `npm test -- components/BottomNav.test.tsx`
Expected: PASS (2).

- [ ] **Step 5: Wire shell + placeholders + manifest**

Create `app/globals.css`:
```css
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1a1a1a; background: #fafafa; }
main { padding: 16px 16px 88px; max-width: 640px; margin: 0 auto; }
button { font: inherit; }
```

Replace `app/layout.tsx`:
```tsx
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
```

Create `app/newsletter/page.tsx` and `app/watchlist/page.tsx`, each:
```tsx
export default function Page() {
  return <main>준비 중</main>;
}
```

Create `public/manifest.webmanifest`:
```json
{
  "name": "증권 뉴스레터 도우미",
  "short_name": "뉴스레터",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#fafafa",
  "theme_color": "#0b62d6",
  "icons": []
}
```

- [ ] **Step 6: Run full test + dev smoke**

Run: `npm test` → all green.
Run: `npm run dev`, open `http://localhost:3000` on a narrow window, confirm bottom nav switches routes. Stop dev.

- [ ] **Step 7: Commit**

```
git add -A
git commit -m "feat: app shell with bottom nav, layout, and web manifest"
```

---

## Task 10: 관심종목 screen

**Files:**
- Modify: `app/watchlist/page.tsx`
- Test: `app/watchlist/page.test.tsx`

**Interfaces:**
- Consumes: `getWatchlist`, `setWatchlist` from `lib/storage.ts`.
- Produces: no exports other than the default page. Behaviors: input + `[추가]` appends (trims, ignores blank/dupe, clears input); each row has a `[삭제]` that removes it; `[내보내기]` fills a `<textarea>` with `list.join("\n")`; `[불러오기]` reads that textarea (newline-split) into the list via `setWatchlist`; all changes persist immediately.

- [ ] **Step 1: Write the failing test**

Create `app/watchlist/page.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Page from "./page";
import { getWatchlist, setWatchlist } from "@/lib/storage";

beforeEach(() => localStorage.clear());

describe("watchlist page", () => {
  it("adds a stock and persists it", async () => {
    render(<Page />);
    await userEvent.type(screen.getByPlaceholderText("종목명 입력"), "삼성전자");
    await userEvent.click(screen.getByText("추가"));
    expect(screen.getByText("삼성전자")).toBeInTheDocument();
    expect(getWatchlist()).toEqual(["삼성전자"]);
  });

  it("loads existing watchlist on mount and deletes a row", async () => {
    setWatchlist(["삼성전자", "SK하이닉스"]);
    render(<Page />);
    expect(await screen.findByText("SK하이닉스")).toBeInTheDocument();
    await userEvent.click(screen.getAllByText("삭제")[0]);
    expect(screen.queryByText("삼성전자")).not.toBeInTheDocument();
    expect(getWatchlist()).toEqual(["SK하이닉스"]);
  });

  it("imports newline-separated text", async () => {
    render(<Page />);
    await userEvent.click(screen.getByText("불러오기"));
    const ta = screen.getByLabelText("관심종목 텍스트");
    await userEvent.clear(ta);
    await userEvent.type(ta, "카카오\nNAVER");
    await userEvent.click(screen.getByText("이 내용으로 저장"));
    expect(getWatchlist()).toEqual(["카카오", "NAVER"]);
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npm test -- app/watchlist/page.test.tsx`
Expected: FAIL (placeholder page has none of these controls).

- [ ] **Step 3: Implement `app/watchlist/page.tsx`**

```tsx
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
          <li key={s} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #eee" }}>
            <span>{s}</span>
            <button onClick={() => commit(list.filter((_, j) => j !== i))}>삭제</button>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button onClick={() => { setText(list.join("\n")); setImportOpen(true); }}>내보내기</button>
        <button onClick={() => { setText(""); setImportOpen(true); }}>불러오기</button>
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
          <button onClick={() => { commit(text.split("\n")); setImportOpen(false); }}>
            이 내용으로 저장
          </button>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npm test -- app/watchlist/page.test.tsx`
Expected: PASS (3).

- [ ] **Step 5: Commit**

```
git add -A
git commit -m "feat: 관심종목 screen with add/delete/import/export"
```

---

## Task 11: 오늘의 추천 screen (main)

**Files:**
- Create: `components/RecItem.tsx`
- Modify: `app/page.tsx`
- Test: `components/RecItem.test.tsx`, `app/page.test.tsx`

**Interfaces:**
- Consumes: `recommend` (`lib/recommend.ts`), `parseChatroom` (`lib/kakaoParse.ts`), all `lib/storage.ts` helpers, `formatKoreanDate` + `kstNow` (`lib/dates.ts`), `CollectionResult`/`RecItem` types.
- Produces:
  - `components/RecItem.tsx`: `export default function RecItem({ rec, checked, onToggle }: { rec: RecItem; checked: boolean; onToggle: (stock: string) => void })` — renders checkbox, stock name, tag chips (`관심종목`/`목표가 상향`/`목표가 하향`/`신규 커버리지`/`단톡방 언급`/`언급 N곳`), and `leadComment — leadBrokerage`; clicking the row body toggles an expanded list of `rec.items` (title + brokerage + link).
  - `app/page.tsx`: the screen. On mount: `loadCollection()` → if present and `collectedAt` within 30 min, reuse; else auto-run `refresh()`. `refresh()` = `fetch('/api/collect')` → `saveCollection` → `saveSnapshot(todayYmd, items)`. Recompute recs with `recommend({ items, watchlist: getWatchlist(), chatroomStocks, prevTargetPrices: loadPrevTargetPrices(todayYmd) })` whenever collection / chatroom / watchlist change. `[전체 보기]` toggles showing `hidden` recs. `[분석에 포함]` runs `parseChatroom(text, collectedStockNames.concat(getWatchlist()))` and stores `matchedStocks` + `rawText`. `[선택한 항목으로 뉴스레터 만들기]` → `saveSelection(checkedStocks)`, `saveMarketSelection(checkedMarketUrls)`, persist chatroom raw/extra via `saveDraft`? No — store chatroom via a dedicated key: add `saveChatroom`/`loadChatroom` usage by reusing `saveSelection`? Keep it simple: write chatroom state into `localStorage` under `snl:chatroom` using `saveCollection`-style — **add two helpers to `lib/storage.ts` in this task**: `saveChatroom(v: {matched: string[]; raw: string})` / `loadChatroom()`. Then `router.push('/newsletter')`.

- [ ] **Step 1: Add `saveChatroom`/`loadChatroom` to `lib/storage.ts` + test**

Append to `lib/storage.ts`:
```ts
export interface ChatroomState { matched: string[]; raw: string }
export function saveChatroom(v: ChatroomState): void {
  write("chatroom", v);
}
export function loadChatroom(): ChatroomState {
  return read<ChatroomState>("chatroom", { matched: [], raw: "" });
}
```
Append to `lib/storage.test.ts`:
```ts
import { saveChatroom, loadChatroom } from "./storage";
// ...
describe("chatroom", () => {
  it("round-trips", () => {
    saveChatroom({ matched: ["에코프로"], raw: "text" });
    expect(loadChatroom()).toEqual({ matched: ["에코프로"], raw: "text" });
  });
});
```
Run: `npm test -- lib/storage.test.ts` → PASS.

- [ ] **Step 2: Write the failing test for `RecItem`**

Create `components/RecItem.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecItem from "./RecItem";
import type { RecItem as RecItemT } from "@/lib/types";

const rec: RecItemT = {
  stock: "삼성전자", mentionCount: 4, brokerages: ["삼성", "미래에셋", "KB", "NH"],
  items: [
    { stock: "삼성전자", title: "목표가 상향", brokerage: "삼성", date: "2026-09-03", sourceSite: "naver", sourceUrl: "u1", kind: "company" },
  ],
  leadComment: "목표가 상향", leadBrokerage: "삼성",
  tags: ["watchlist", "target-up"], isWatchlist: true, hidden: false, score: 0,
};

describe("RecItem", () => {
  it("shows stock, tags, lead comment, and mention count", () => {
    render(<RecItem rec={rec} checked={false} onToggle={() => {}} />);
    expect(screen.getByText("삼성전자")).toBeInTheDocument();
    expect(screen.getByText("관심종목")).toBeInTheDocument();
    expect(screen.getByText("목표가 상향")).toBeInTheDocument();
    expect(screen.getByText("언급 4곳")).toBeInTheDocument();
  });
  it("fires onToggle with the stock when the checkbox is clicked", async () => {
    const onToggle = vi.fn();
    render(<RecItem rec={rec} checked={false} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledWith("삼성전자");
  });
  it("expands to show underlying reports on row click", async () => {
    render(<RecItem rec={rec} checked={false} onToggle={() => {}} />);
    await userEvent.click(screen.getByText("목표가 상향 · 삼성"));
    expect(screen.getByRole("link")).toHaveAttribute("href", "u1");
  });
});
```

- [ ] **Step 3: Run — verify fail**

Run: `npm test -- components/RecItem.test.tsx`
Expected: FAIL (`./RecItem` not found).

- [ ] **Step 4: Implement `components/RecItem.tsx`**

```tsx
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
              {rec.items.map((it, i) => (
                <li key={i} style={{ fontSize: 13, color: "#555" }}>
                  <a href={it.sourceUrl} target="_blank" rel="noreferrer">
                    {it.title} · {it.brokerage}
                  </a>
                </li>
              ))}
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
```

- [ ] **Step 5: Run — verify pass**

Run: `npm test -- components/RecItem.test.tsx`
Expected: PASS (3).

- [ ] **Step 6: Write the failing test for `app/page.tsx`**

Create `app/page.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CollectionResult } from "@/lib/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/" }));

const collection: CollectionResult = {
  collectedAt: new Date().toISOString(),
  failures: [],
  items: [
    { stock: "삼성전자", title: "목표가 상향", brokerage: "삼성", date: "2026-09-03", sourceSite: "naver", sourceUrl: "u1", kind: "company" },
    { stock: "삼성전자", title: "3분기 프리뷰", brokerage: "NH", date: "2026-09-03", sourceSite: "naver", sourceUrl: "u2", kind: "company" },
    { stock: "동화기업", title: "리포트", brokerage: "키움", date: "2026-09-03", sourceSite: "naver", sourceUrl: "u3", kind: "company" },
  ],
};

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => collection })) as unknown as typeof fetch);
});

import Page from "./page";

describe("추천 screen", () => {
  it("auto-collects on mount and shows a >=2-brokerage rec, hiding the single one", async () => {
    render(<Page />);
    expect(await screen.findByText("삼성전자")).toBeInTheDocument();
    expect(screen.queryByText("동화기업")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("전체 보기"));
    expect(screen.getByText("동화기업")).toBeInTheDocument();
  });

  it("includes pasted chat-room stocks in analysis", async () => {
    render(<Page />);
    await screen.findByText("삼성전자");
    await userEvent.type(screen.getByPlaceholderText(/카톡방/), "동화기업 오늘 좋네요");
    await userEvent.click(screen.getByText("분석에 포함"));
    await waitFor(() => expect(screen.getByText("단톡방 언급")).toBeInTheDocument());
  });

  it("saves selection and navigates to /newsletter", async () => {
    render(<Page />);
    await screen.findByText("삼성전자");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByText("선택한 항목으로 뉴스레터 만들기"));
    expect(JSON.parse(localStorage.getItem("snl:selection")!)).toEqual(["삼성전자"]);
    expect(push).toHaveBeenCalledWith("/newsletter");
  });
});
```

- [ ] **Step 7: Run — verify fail**

Run: `npm test -- app/page.test.tsx`
Expected: FAIL (placeholder page).

- [ ] **Step 8: Implement `app/page.tsx`**

```tsx
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RecItem from "@/components/RecItem";
import { recommend } from "@/lib/recommend";
import { parseChatroom } from "@/lib/kakaoParse";
import { formatKoreanDate, kstNow } from "@/lib/dates";
import type { CollectionResult } from "@/lib/types";
import {
  loadCollection, saveCollection, saveSnapshot, loadPrevTargetPrices,
  getWatchlist, saveSelection, saveMarketSelection, saveChatroom,
} from "@/lib/storage";

const FRESH_MS = 30 * 60 * 1000;
const todayYmd = () => kstNow().toISOString().slice(0, 10);

export default function Page() {
  const router = useRouter();
  const [collection, setCollection] = useState<CollectionResult | null>(null);
  const [loading, setLoading] = useState(false);
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
      }
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
      next.has(stock) ? next.delete(stock) : next.add(stock);
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
    saveSelection([...checked]);
    const marketUrls = (recs?.market ?? []).map((m) => m.sourceUrl);
    saveMarketSelection(marketUrls.filter((u) => checked.has(u)));
    saveChatroom(chat);
    router.push("/newsletter");
  };

  const visibleCompany = (recs?.company ?? []).filter((r) => showAll || !r.hidden);

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 18 }}>오늘의 추천</h1>
        <span style={{ fontSize: 12, color: "#888" }}>{formatKoreanDate()}</span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0" }}>
        <button onClick={() => void refresh()} disabled={loading}>
          {loading ? "수집 중…" : "새로고침"}
        </button>
        <button onClick={() => setShowAll((v) => !v)}>{showAll ? "추천만 보기" : "전체 보기"}</button>
        {collection?.failures.map((f) => (
          <span key={f} style={{ fontSize: 12, color: "#c00" }}>{f} 수집 실패</span>
        ))}
      </div>

      {recs && visibleCompany.length === 0 && (
        <p style={{ color: "#666" }}>오늘은 2곳 이상 겹친 종목이 없습니다. “전체 보기”로 전체 리포트를 확인하세요.</p>
      )}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {visibleCompany.map((r) => (
          <RecItem key={r.stock} rec={r} checked={checked.has(r.stock)} onToggle={toggle} />
        ))}
      </ul>

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
```

- [ ] **Step 9: Run — verify pass**

Run: `npm test -- app/page.test.tsx components/RecItem.test.tsx`
Expected: PASS (3 + 3).

- [ ] **Step 10: Commit**

```
git add -A
git commit -m "feat: 오늘의 추천 screen — collect, recommend, chat-room paste, selection"
```

---

## Task 12: 뉴스레터 초안 screen

**Files:**
- Modify: `app/newsletter/page.tsx`
- Test: `app/newsletter/page.test.tsx`

**Interfaces:**
- Consumes: `buildNewsletter` (`lib/newsletter.ts`), `loadCollection`/`loadSelection`/`loadMarketSelection`/`loadChatroom`/`saveDraft`/`loadDraft` (`lib/storage.ts`), `recommend` (`lib/recommend.ts`), `formatKoreanDate` (`lib/dates.ts`).
- Produces: default page only. On mount: rebuild recs from `loadCollection()` (same `recommend(...)` call as the main screen), pick the `RecItem`s whose `stock ∈ loadSelection()`, pick market items whose `sourceUrl ∈ loadMarketSelection()`, read `loadChatroom()`. If `loadDraft()` exists use it as the textarea's initial value; else `buildNewsletter(...)`. `[전체 복사]` → `navigator.clipboard.writeText`. `[카톡으로 보내기]` → if `navigator.share` call `navigator.share({ text })`, else fall back to clipboard copy + alert. Textarea edits persist via `saveDraft` (on change).

- [ ] **Step 1: Write the failing test**

Create `app/newsletter/page.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CollectionResult } from "@/lib/types";

vi.mock("next/navigation", () => ({ usePathname: () => "/newsletter" }));

const collection: CollectionResult = {
  collectedAt: new Date().toISOString(),
  failures: [],
  items: [
    { stock: "삼성전자", title: "목표가 상향", brokerage: "삼성", date: "2026-09-03", sourceSite: "naver", sourceUrl: "u1", kind: "company" },
    { stock: "삼성전자", title: "3분기 프리뷰", brokerage: "NH", date: "2026-09-03", sourceSite: "naver", sourceUrl: "u2", kind: "company" },
  ],
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("snl:collection", JSON.stringify(collection));
  localStorage.setItem("snl:selection", JSON.stringify(["삼성전자"]));
  localStorage.setItem("snl:marketSelection", JSON.stringify([]));
});

import Page from "./page";

describe("뉴스레터 screen", () => {
  it("builds the draft from the saved selection", async () => {
    render(<Page />);
    const ta = (await screen.findByRole("textbox")) as HTMLTextAreaElement;
    expect(ta.value).toContain("📈 오늘의 증권가 브리핑");
    expect(ta.value).toContain("• 삼성전자 — 목표가 상향");
  });

  it("copies via clipboard on 전체 복사", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<Page />);
    await screen.findByRole("textbox");
    await userEvent.click(screen.getByText("전체 복사"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("오늘의 증권가 브리핑"));
  });

  it("uses navigator.share on 카톡으로 보내기 when available", async () => {
    const share = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, share });
    render(<Page />);
    await screen.findByRole("textbox");
    await userEvent.click(screen.getByText("카톡으로 보내기"));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining("증권가 브리핑") }));
  });

  it("persists edits to the draft", async () => {
    render(<Page />);
    const ta = await screen.findByRole("textbox");
    await userEvent.type(ta, " 추가메모");
    expect(localStorage.getItem("snl:draft")).toContain("추가메모");
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npm test -- app/newsletter/page.test.tsx`
Expected: FAIL (placeholder page).

- [ ] **Step 3: Implement `app/newsletter/page.tsx`**

```tsx
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
```

- [ ] **Step 4: Run — verify pass**

Run: `npm test -- app/newsletter/page.test.tsx`
Expected: PASS (4).

- [ ] **Step 5: Full suite + dev smoke of the whole flow**

Run: `npm test` → all green.
Run: `npm run dev`. Walk the flow on a narrow window: 추천 새로고침 → check items → 뉴스레터 만들기 → draft renders → 전체 복사 works. Stop dev.

- [ ] **Step 6: Commit**

```
git add -A
git commit -m "feat: 뉴스레터 초안 screen — build, edit, copy, KakaoTalk share"
```

---

## Task 13: README + Vercel deploy guide

**Files:**
- Create: `README.md`
- Modify: `package.json` (add `"engines": { "node": ">=20" }`)

**Interfaces:**
- Consumes: nothing.
- Produces: documentation only.

- [ ] **Step 1: Write `README.md`**

````markdown
# 증권 뉴스레터 도우미

매일 아침 네이버 금융 리서치 + 한경 컨센서스에서 증권사 리포트를 모아
"뉴스가 될 만한" 종목을 추천하고, 고른 항목으로 불릿 형식 뉴스레터를 만들어
카카오톡 "나와의 채팅"으로 보내는 모바일 웹앱.

## 로컬에서 실행

전제: Node.js 20 이상. (`winget install OpenJS.NodeJS.LTS`)

```
npm install
npm run dev       # http://localhost:3000
npm test          # 전체 테스트
```

## 배포 (Vercel, 무료)

1. https://vercel.com 에서 GitHub 계정으로 무료 가입 (카드 등록 불필요).
2. 이 폴더를 GitHub 저장소로 올린다:
   ```
   git remote add origin <내-저장소-URL>
   git push -u origin main
   ```
3. Vercel 대시보드 → **Add New… → Project** → 방금 만든 저장소 선택 → **Deploy**.
   (환경변수 설정 없음. 빌드 설정은 자동 감지.)
4. 배포가 끝나면 `https://<프로젝트>.vercel.app` 주소가 나온다.
   휴대폰에서 이 주소를 열고 **홈 화면에 추가**한다.

이후 `git push` 할 때마다 자동으로 다시 배포된다.

## 매일 아침 사용법

1. 홈 화면 아이콘으로 앱을 연다 → 자동으로 최신 자료를 수집한다.
2. **오늘의 추천**에서 다룰 항목을 체크한다. 필요하면 **카톡방 내용 붙여넣기**에
   단톡방에서 복사한 텍스트를 넣고 **분석에 포함**을 누른다.
3. **선택한 항목으로 뉴스레터 만들기** → 초안을 확인/수정한다.
4. **카톡으로 보내기** → 공유창에서 **나와의 채팅** 선택.
   (데스크톱 등 공유 미지원 환경에서는 자동으로 "전체 복사"로 동작한다.)

## 한계

- 네이버·한경이 사이트 구조를 바꾸면 수집이 멈출 수 있다. 그때는
  `lib/sources/naver.ts` / `lib/sources/hankyung.ts` 의 선택자를 갱신해야 한다.
- 목표가 변동폭(%)은 직전에 앱을 연 날의 스냅샷과 비교한다. 매일 열지 않으면
  그날 변동폭은 표시되지 않는다(상향/하향 방향 태그는 제목 기반이라 항상 표시).
- 장중 속보는 다루지 않는다. 아침 리포트/시황 정리용이다.
- 관심종목·초안·스냅샷은 이 브라우저에만 저장된다. 브라우저 데이터를 지우면
  사라지므로 **관심종목** 화면의 내보내기로 가끔 백업한다.
````

- [ ] **Step 2: Add Node engine floor to `package.json`**

Add top-level:
```json
"engines": { "node": ">=20" }
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build completes with no type errors. Fix any before committing.

- [ ] **Step 4: Commit**

```
git add -A
git commit -m "docs: README with local run, Vercel deploy, and daily usage guide"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Covered by |
|---|---|
| §1 정보 종류 A/C/D, 출처 네이버·한경 | Tasks 2, 3, 4 |
| §1 관심 범위 전방위, 뉴스감 기준(2곳 언급 + 관심종목) | Task 5 |
| §1 방향 2 (검토·선택) | Tasks 11, 12 |
| §1 결과물 → 카카오 "나와의 채팅" | Task 12 (`navigator.share`) |
| §1 오전 8시 / 앱 열 때 수집 | Task 11 (auto-collect on mount, 30-min freshness) |
| §2 웹앱 1개, 프론트+수집 API, Next.js/TS/Vercel, cheerio, vitest | Tasks 1, 4, 13 |
| §2 DB 없음 / localStorage | Task 8 |
| §2 규칙 기반, AI 미사용 | Task 5 (no LLM anywhere) |
| §2 카카오 개발자 등록 불필요 (share sheet) | Task 12 |
| §3 화면 ① 추천 (새로고침, 태그, 정렬, 펼침, 전체 보기, 카톡방 붙여넣기, 하단 버튼) | Tasks 11 (+ RecItem) |
| §3 화면 ② 뉴스레터 초안 (자동 조립, 편집, 복사, 카톡, 초안 보관) | Task 12 |
| §3 화면 ③ 관심종목 (추가/삭제, 내보내기/불러오기, 우선표시) | Task 10 (우선표시 via Task 5 sort) |
| §3 하단 탭 이동 | Task 9 |
| §4.1 수집 대상·범위·정규화·중복제거·부분 실패 | Tasks 2, 3, 4 |
| §4.2 추천 점수/태그 (언급 수, 관심종목, 목표가 방향, 신규 커버리지, 단톡방) | Task 5 |
| §4.3 카톡방 파싱 (사전 대조, 미검출 시 원문 보존) | Task 6 + Task 12 (chatroomRaw fallback) |
| §4.4 노이즈 제거 | Task 5 (`hidden`) + Task 11 (전체 보기) |
| §4.5 스냅샷 (저장, 이전값 비교, 14일 보관) | Task 8 |
| §5.1 형식 A 불릿, 섹션 분류·우선순위, 대표 코멘트/증권사 표기 | Task 7 |
| §5.2 전체 복사 / navigator.share + 폴백 | Task 12 |
| §6 대응 (수집 실패 배지, 추천 0건 문구, 단톡방 원문 보존, 공유 폴백, localStorage 소실 백업) | Tasks 11, 12, 10 |
| §7 자동 테스트 (파서/정규화/추천/뉴스레터/카톡파싱) + 인수 테스트 | every task's TDD steps + Task 13 README |
| §8 프로젝트 구조 | File Structure table above matches |
| §9 범위 밖 (스케줄러, AI 다듬기, 단체발송, 해외 원문) | intentionally not planned |

No gaps found.

**2. Placeholder scan**

The only intentional fill-ins are the `EXPECT_*` values in Tasks 2 & 3 tests — these require reading the just-saved live-site fixture (unavoidable: real DOM values, and the sites' markup can drift). Each is accompanied by explicit instructions on which fixture rows to read. No `TBD`/`TODO`/"handle edge cases"/"similar to Task N" anywhere; every code step has complete code.

**3. Type consistency**

- `ResearchItem`, `RecItem`, `RecTag`, `CollectionResult`, `ChatroomState` — defined in Task 1 / extended in Task 11 Step 1; used with identical shapes in Tasks 2–12.
- `recommend(input: RecommendInput): RecommendOutput` — signature identical in Task 5 (def) and Tasks 11, 12 (consumers).
- `buildNewsletter(input: NewsletterInput): string` — Task 7 def matches Task 12 call (`dateLabel`, `company`, `market`, `chatroomExtra`, `chatroomRaw`).
- `parseChatroom(text, extraDictionary?)` — Task 6 def matches Task 11 call.
- storage helpers — names used in Tasks 11/12 (`loadCollection`, `saveSnapshot`, `loadPrevTargetPrices`, `getWatchlist`, `saveSelection`, `saveMarketSelection`, `saveChatroom`, `loadChatroom`, `saveDraft`, `loadDraft`) all defined in Task 8 / Task 11 Step 1.
- `RecItem` component props (`rec`, `checked`, `onToggle`) identical in Task 11 def and its test.

No mismatches found.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-03-stock-newsletter-assistant.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

**Which approach?**
