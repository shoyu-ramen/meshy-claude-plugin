import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitForTask } from "../src/poll.js";

const taskResponse = (status: string, progress: number, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ id: "t1", status, progress, ...extra }), { status: 200 });

describe("waitForTask", () => {
  const fetchMock = vi.fn();
  const instantSleep = () => Promise.resolve();

  beforeEach(() => {
    vi.stubEnv("MESHY_API_KEY", "msy_test");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("polls until SUCCEEDED, reporting progress along the way", async () => {
    fetchMock
      .mockResolvedValueOnce(taskResponse("PENDING", 0, { preceding_tasks: 3 }))
      .mockResolvedValueOnce(taskResponse("IN_PROGRESS", 50))
      .mockResolvedValueOnce(taskResponse("SUCCEEDED", 100));
    const progress: Array<[number, string]> = [];
    const { timedOut, task } = await waitForTask("text-to-3d", "t1", {
      timeoutSeconds: 60,
      pollIntervalSeconds: 5,
      sleep: instantSleep,
      onProgress: async (p, m) => {
        progress.push([p, m]);
      },
    });
    expect(timedOut).toBe(false);
    expect(task.status).toBe("SUCCEEDED");
    expect(progress).toEqual([
      [0, "text-to-3d PENDING (3 tasks ahead in queue)"],
      [50, "text-to-3d IN_PROGRESS"],
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.meshy.ai/openapi/v2/text-to-3d/t1");
  });

  it("returns timedOut with current state instead of throwing", async () => {
    fetchMock.mockResolvedValue(taskResponse("IN_PROGRESS", 42));
    const { timedOut, task } = await waitForTask("rigging", "t2", {
      timeoutSeconds: 0,
      pollIntervalSeconds: 5,
      sleep: instantSleep,
    });
    expect(timedOut).toBe(true);
    expect(task.progress).toBe(42);
  });

  it("returns FAILED task without throwing (caller decides)", async () => {
    fetchMock.mockResolvedValueOnce(
      taskResponse("FAILED", 10, { task_error: { message: "not humanoid" } }),
    );
    const { timedOut, task } = await waitForTask("rigging", "t3", {
      timeoutSeconds: 60,
      pollIntervalSeconds: 5,
      sleep: instantSleep,
    });
    expect(timedOut).toBe(false);
    expect(task.status).toBe("FAILED");
    expect(task.task_error?.message).toBe("not humanoid");
  });
});
