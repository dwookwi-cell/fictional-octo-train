import { fetchLinkInfo } from "@/lib/linkInfo";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "요청 형식이 잘못되었습니다." }, { status: 400 });
  }
  const urls = (body as { urls?: unknown } | null)?.urls;
  if (!Array.isArray(urls) || !urls.every((u) => typeof u === "string")) {
    return Response.json({ error: "urls는 문자열 배열이어야 합니다." }, { status: 400 });
  }
  return Response.json(await fetchLinkInfo(urls), { headers: { "Cache-Control": "no-store" } });
}
