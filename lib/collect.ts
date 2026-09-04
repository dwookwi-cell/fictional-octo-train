import type { CollectionResult, ResearchItem, SourceSite } from "@/lib/types";
import { dedupeItems } from "@/lib/normalize";
import { isRecentKST } from "@/lib/dates";

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
