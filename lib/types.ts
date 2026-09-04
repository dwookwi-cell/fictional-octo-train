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
  extraUrls?: string[]; // additional 원문 links from merged cross-source duplicates
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
