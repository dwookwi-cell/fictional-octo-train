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
