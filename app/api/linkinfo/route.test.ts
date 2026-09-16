import { describe, it, expect } from "vitest";
import { POST } from "./route";

const req = (body: string) =>
  new Request("http://localhost/api/linkinfo", {
    method: "POST",
    body,
    headers: { "content-type": "application/json" },
  });

describe("POST /api/linkinfo", () => {
  it("rejects a body that is not { urls: string[] }", async () => {
    expect((await POST(req("not json"))).status).toBe(400);
    expect((await POST(req(JSON.stringify({ urls: [1] })))).status).toBe(400);
    expect((await POST(req(JSON.stringify({})))).status).toBe(400);
  });

  it("returns an empty map when every link is a skipped host (no network)", async () => {
    const r = await POST(req(JSON.stringify({ urls: ["https://finance.naver.com/sise/"] })));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({});
  });
});
