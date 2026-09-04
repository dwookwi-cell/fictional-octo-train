import { NextResponse } from "next/server";
import { collect } from "@/lib/collect";
import { fetchNaverResearch } from "@/lib/sources/naver";
import { fetchHankyungConsensus } from "@/lib/sources/hankyung";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const result = await collect({ naver: fetchNaverResearch, hankyung: fetchHankyungConsensus });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
