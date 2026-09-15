/**
 * 당근마켓 키워드 감시 — 수동 실행 스크립트.
 *
 *   npm run watch:daangn            지난 실행 이후 새로 올라온 매물만 출력
 *   npm run watch:daangn -- --all   조건에 맞는 매물 전체 출력
 *   npm run watch:daangn -- --dry-run   상태 파일(data/daangn-watch-seen.json)을 건드리지 않음
 *
 * 설정은 watch.config.json (regionSlug / keywords / ongoingOnly).
 * 첫 실행은 비교 기준이 없어 매칭되는 매물이 전부 "신규"로 나옵니다 — 한 번
 * 돌려 기준선을 만든 뒤부터 진짜 신규만 잡힙니다.
 *
 * 카카오톡 '나에게 보내기' 전송은 이 스크립트가 하지 않습니다. 출력만 하며,
 * 전송은 세션에서 Claude가 결과를 읽어 처리합니다.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fetchDaangnSearch, type DaangnListing } from "@/lib/watch/daangn";
import { selectMatches, formatListing } from "@/lib/watch/run";
import { readSeen, writeSeen, diffNew, commitSeen } from "@/lib/watch/state";

interface WatchConfig {
  regionSlug: string;
  regionLabel?: string;
  keywords: string[];
  ongoingOnly?: boolean;
}

const ROOT = process.cwd();
const CONFIG_PATH = join(ROOT, "watch.config.json");
const STATE_PATH = join(ROOT, "data", "daangn-watch-seen.json");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const showAll = args.has("--all");
  const dryRun = args.has("--dry-run");

  const cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as WatchConfig;
  if (!cfg.regionSlug || !Array.isArray(cfg.keywords) || cfg.keywords.length === 0) {
    console.error("watch.config.json 에 regionSlug 와 비어있지 않은 keywords 배열이 필요합니다.");
    process.exit(1);
  }
  const ongoingOnly = cfg.ongoingOnly ?? true;

  // 키워드당 요청 1회. 당근이 가끔 빈 셸을 주므로 결과가 0이면 한 번 더 재시도.
  // reached=true 는 "당근 페이지는 받았다"는 뜻 (매물 0건이어도 정상).
  const all: DaangnListing[] = [];
  let reached = false;
  for (const kw of cfg.keywords) {
    let got: DaangnListing[] | null = null;
    for (let attempt = 1; attempt <= 2 && (got === null || got.length === 0); attempt++) {
      got = await fetchDaangnSearch(kw, { regionSlug: cfg.regionSlug });
      if ((got === null || got.length === 0) && attempt < 2) await sleep(1200);
    }
    if (got !== null) {
      reached = true;
      all.push(...got);
    }
  }

  const matches = selectMatches(all, cfg.keywords, { ongoingOnly });
  const seen = readSeen(STATE_PATH);
  const fresh = showAll ? matches : diffNew(matches, seen);

  const label = cfg.regionLabel ?? cfg.regionSlug;
  console.log(`[당근] ${cfg.keywords.join(", ")} · ${label} · ${new Date().toLocaleString("ko-KR")}`);

  if (!reached) {
    console.log("당근에서 매물을 받아오지 못했습니다 (네트워크 또는 차단). 잠시 후 다시 시도하세요.");
  } else if (fresh.length === 0) {
    console.log(showAll ? "조건에 맞는 매물이 없습니다." : "새로 올라온 매물이 없습니다.");
  } else {
    console.log(`${showAll ? "매칭" : "신규"} ${fresh.length}건`);
    for (const l of fresh) console.log("  - " + formatListing(l));
  }

  if (!dryRun && matches.length > 0) {
    writeSeen(STATE_PATH, commitSeen(seen, matches));
  }
}

main().catch((err) => {
  console.error("watch-daangn 실패:", err);
  process.exit(1);
});
