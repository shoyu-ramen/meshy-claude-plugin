import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KEY_HELP, MeshyError, meshyFetch } from "../src/client.js";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("meshyFetch", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("MESHY_API_KEY", "msy_test");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("throws actionable help without an API key, before any network call", async () => {
    vi.stubEnv("MESHY_API_KEY", "");
    await expect(meshyFetch("/openapi/v1/balance")).rejects.toThrow(/meshy.ai\/settings\/api/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends Bearer auth and JSON body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { result: "id-1" }));
    const res = await meshyFetch("/openapi/v2/text-to-3d", { method: "POST", body: { mode: "preview" } });
    expect(res).toEqual({ result: "id-1" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.meshy.ai/openapi/v2/text-to-3d");
    expect(init.headers.Authorization).toBe("Bearer msy_test");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ mode: "preview" });
  });

  it("maps 401 to key help", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { message: "unauthorized" }));
    await expect(meshyFetch("/x")).rejects.toThrow(KEY_HELP);
  });

  it("maps 402 to credits guidance", async () => {
    fetchMock.mockResolvedValue(jsonResponse(402, { message: "no credits" }));
    await expect(meshyFetch("/x")).rejects.toThrow(/Insufficient Meshy credits/);
  });

  it("maps 404 to task_type hint", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { message: "not found" }));
    await expect(meshyFetch("/openapi/v1/rigging/abc")).rejects.toThrow(/task_type/);
  });

  it("retries 429 then succeeds", async () => {
    vi.useFakeTimers();
    try {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(429, { message: "slow down" }))
        .mockResolvedValueOnce(jsonResponse(200, { balance: 5 }));
      const promise = meshyFetch("/openapi/v1/balance");
      await vi.runAllTimersAsync();
      await expect(promise).resolves.toEqual({ balance: 5 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("exhausts retries on 500 and surfaces status", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockResolvedValue(jsonResponse(500, { message: "boom" }));
      const promise = meshyFetch("/x", { retries: 2 });
      const assertion = expect(promise).rejects.toMatchObject({ status: 500 } satisfies Partial<MeshyError>);
      await vi.runAllTimersAsync();
      await assertion;
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries network errors", async () => {
    vi.useFakeTimers();
    try {
      fetchMock
        .mockRejectedValueOnce(new Error("ECONNRESET"))
        .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
      const promise = meshyFetch("/x");
      await vi.runAllTimersAsync();
      await expect(promise).resolves.toEqual({ ok: true });
    } finally {
      vi.useRealTimers();
    }
  });
});
