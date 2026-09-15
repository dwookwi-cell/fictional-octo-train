/**
 * Pure helpers for the watch script: turn raw listings into the shortlist of
 * keyword hits, and render one for the report.
 */

import type { DaangnListing } from "./daangn";
import { matchesAnyKeyword } from "./match";

export interface SelectOpts {
  /** Drop listings that are already 예약중 / 거래완료. */
  ongoingOnly: boolean;
}

const STATUS_TAG: Record<string, string> = {
  Reserved: "예약중",
  Closed: "거래완료",
};

export function selectMatches(
  listings: DaangnListing[],
  keywords: string[],
  opts: SelectOpts,
): DaangnListing[] {
  const seen = new Set<string>();
  const out: DaangnListing[] = [];
  for (const l of listings) {
    if (seen.has(l.id)) continue;
    if (!matchesAnyKeyword(l.title, keywords)) continue;
    if (opts.ongoingOnly && l.status !== "Ongoing") continue;
    seen.add(l.id);
    out.push(l);
  }
  out.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return out;
}

export function formatListing(l: DaangnListing): string {
  const tag = STATUS_TAG[l.status] ? `[${STATUS_TAG[l.status]}] ` : "";
  const price = l.price === null ? "나눔/제안" : `${l.price.toLocaleString("en-US")}원`;
  return `${tag}${price} · ${l.title} · ${l.region} · ${l.url}`;
}
