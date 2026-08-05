import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { collectAssets, downloadAssets } from "../src/download.js";

const URL_BASE = "https://assets.example.com/task/output";

const modelTask = {
  id: "t1",
  status: "SUCCEEDED",
  model_urls: {
    glb: `${URL_BASE}/model.glb?sig=1`,
    fbx: `${URL_BASE}/model.fbx?sig=1`,
    mtl: `${URL_BASE}/model.mtl?sig=1`,
    usdz: "",
  },
  texture_urls: [
    {
      base_color: `${URL_BASE}/texture_0.png?sig=1`,
      normal: `${URL_BASE}/texture_0_normal.png?sig=1`,
    },
  ],
  thumbnail_url: `${URL_BASE}/preview.png?sig=1`,
  video_url: "",
};

describe("collectAssets", () => {
  it("collects model, texture, and thumbnail assets", () => {
    const assets = collectAssets(modelTask);
    const names = assets.map((a) => a.name).sort();
    expect(names).toEqual(
      ["model.glb", "model.fbx", "model.mtl", "texture_base_color.png", "texture_normal.png", "thumbnail.png"].sort(),
    );
  });

  it("filters model formats but keeps mtl companion", () => {
    const assets = collectAssets(modelTask, { formats: ["glb"] });
    const names = assets.map((a) => a.name);
    expect(names).toContain("model.glb");
    expect(names).toContain("model.mtl");
    expect(names).not.toContain("model.fbx");
  });

  it("can exclude textures", () => {
    const names = collectAssets(modelTask, { includeTextures: false }).map((a) => a.name);
    expect(names.some((n) => n.startsWith("texture"))).toBe(false);
    expect(names).toContain("model.glb");
  });

  it("collects image task outputs", () => {
    const assets = collectAssets({ image_urls: [`${URL_BASE}/a.png?x=1`, `${URL_BASE}/b.png?x=1`] });
    expect(assets.map((a) => a.name)).toEqual(["image_0.png", "image_1.png"]);
  });

  it("collects nested animation result urls", () => {
    const assets = collectAssets({
      result: {
        animation_glb_url: `${URL_BASE}/anim.glb?x=1`,
        animation_fbx_url: `${URL_BASE}/anim.fbx?x=1`,
      },
    });
    expect(assets.map((a) => a.name).sort()).toEqual(["animation_fbx.fbx", "animation_glb.glb"]);
  });

  it("dedupes repeated urls and skips non-http values", () => {
    const url = `${URL_BASE}/one.glb`;
    const assets = collectAssets({
      model_urls: { glb: url },
      extra_url: url,
      weird_url: "not-a-url",
    });
    expect(assets).toHaveLength(1);
  });
});

describe("downloadAssets", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("streams assets to disk and returns an absolute manifest", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => new Response(`bytes-of:${url}`)),
    );
    const dir = await mkdtemp(path.join(tmpdir(), "meshy-dl-"));
    const manifest = await downloadAssets(
      [
        { name: "model.glb", url: `${URL_BASE}/model.glb` },
        { name: "thumbnail.png", url: `${URL_BASE}/preview.png` },
      ],
      dir,
    );
    expect(manifest).toHaveLength(2);
    for (const entry of manifest) {
      expect(path.isAbsolute(entry.file)).toBe(true);
      expect(entry.bytes).toBeGreaterThan(0);
    }
    const glb = await readFile(path.join(dir, "model.glb"), "utf8");
    expect(glb).toBe(`bytes-of:${URL_BASE}/model.glb`);
  });

  it("fails with expiry hint on non-200", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("gone", { status: 403 })));
    await expect(
      downloadAssets([{ name: "model.glb", url: `${URL_BASE}/model.glb` }], tmpdir()),
    ).rejects.toThrow(/expire/);
  });
});
