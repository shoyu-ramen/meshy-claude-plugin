import { describe, expect, it } from "vitest";
import { summarizeTask } from "../src/summarize.js";

describe("summarizeTask", () => {
  it("keeps key fields, drops signed URLs, lists available assets", () => {
    const summary = summarizeTask({
      id: "t1",
      type: "text-to-3d-refine",
      status: "SUCCEEDED",
      progress: 100,
      prompt: "palm tree",
      consumed_credits: 10,
      task_error: null,
      model_urls: { glb: "https://x/model.glb?sig=long", fbx: "https://x/model.fbx?sig=long", usdz: "" },
      texture_urls: [{ base_color: "https://x/t.png?sig=long", normal: "https://x/n.png?sig=long" }],
      thumbnail_url: "https://x/p.png?sig=long",
      video_url: "",
    });
    expect(summary.id).toBe("t1");
    expect(summary.status).toBe("SUCCEEDED");
    expect(summary.available_assets).toEqual({
      model_formats: ["glb", "fbx"],
      texture_maps: ["base_color", "normal"],
      thumbnail: true,
    });
    expect(JSON.stringify(summary)).not.toContain("sig=long");
    expect(summary).not.toHaveProperty("task_error");
  });

  it("surfaces task_error and animation outputs", () => {
    const summary = summarizeTask({
      id: "t2",
      status: "FAILED",
      task_error: { message: "boom" },
      result: { animation_glb_url: "https://x/a.glb?sig=1", other: 1 },
    });
    expect(summary.task_error).toEqual({ message: "boom" });
    expect((summary.available_assets as Record<string, unknown>).animation_outputs).toEqual([
      "animation_glb_url",
    ]);
  });
});
