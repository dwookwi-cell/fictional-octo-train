/**
 * Seen-state store for the used-goods watcher.
 *
 * A tiny JSON file, `{ [listingId]: firstSeenISO }`, records which listings a
 * previous run already reported so the next run can show only what is new.
 * Reads are forgiving: a missing or corrupt file is treated as "nothing seen
 * yet" rather than an error.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { DaangnListing } from "./daangn";

export type SeenState = Record<string, string>;

export function readSeen(path: string): SeenState {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as SeenState;
    }
    return {};
  } catch {
    return {};
  }
}

export function writeSeen(path: string, state: SeenState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n");
}

export function diffNew(listings: DaangnListing[], seen: SeenState): DaangnListing[] {
  return listings.filter((l) => !(l.id in seen));
}

export function commitSeen(
  seen: SeenState,
  listings: DaangnListing[],
  now: string = new Date().toISOString(),
): SeenState {
  const next: SeenState = { ...seen };
  for (const l of listings) {
    if (!(l.id in next)) next[l.id] = now;
  }
  return next;
}
