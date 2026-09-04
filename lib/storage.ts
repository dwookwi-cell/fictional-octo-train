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

export interface ChatroomState {
  matched: string[];
  raw: string;
}
export function saveChatroom(v: ChatroomState): void {
  write("chatroom", v);
}
export function loadChatroom(): ChatroomState {
  return read<ChatroomState>("chatroom", { matched: [], raw: "" });
}
