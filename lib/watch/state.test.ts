import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSeen, writeSeen, diffNew, commitSeen } from "./state";
import type { DaangnListing } from "./daangn";

const listing = (id: string): DaangnListing => ({
  id,
  title: `item ${id}`,
  price: 1000,
  region: "송도동",
  url: `https://www.daangn.com/kr/buy-sell/x-${id}/`,
  createdAt: "2026-09-09T00:00:00.000Z",
  status: "Ongoing",
});

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "watch-state-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("readSeen / writeSeen", () => {
  it("round-trips a state map through a JSON file", () => {
    const path = join(dir, "nested", "seen.json");
    writeSeen(path, { a1: "2026-09-01T00:00:00.000Z" });
    expect(existsSync(path)).toBe(true);
    expect(readSeen(path)).toEqual({ a1: "2026-09-01T00:00:00.000Z" });
  });

  it("returns {} for a missing file", () => {
    expect(readSeen(join(dir, "nope.json"))).toEqual({});
  });

  it("returns {} for a corrupt file instead of throwing", () => {
    const path = join(dir, "bad.json");
    writeFileSync(path, "{not json");
    expect(readSeen(path)).toEqual({});
  });
});

describe("diffNew", () => {
  it("keeps only listings whose id is absent from the seen map", () => {
    const seen = { a1: "2026-09-01T00:00:00.000Z" };
    const out = diffNew([listing("a1"), listing("a2"), listing("a3")], seen);
    expect(out.map((l) => l.id)).toEqual(["a2", "a3"]);
  });
});

describe("commitSeen", () => {
  it("adds new ids with the given timestamp and preserves existing ones", () => {
    const seen = { a1: "2026-09-01T00:00:00.000Z" };
    const next = commitSeen(seen, [listing("a1"), listing("a2")], "2026-09-09T12:00:00.000Z");
    expect(next).toEqual({
      a1: "2026-09-01T00:00:00.000Z",
      a2: "2026-09-09T12:00:00.000Z",
    });
    expect(seen).toEqual({ a1: "2026-09-01T00:00:00.000Z" }); // input not mutated
  });
});
