import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export interface Asset {
  name: string;
  url: string;
}

function extFromUrl(url: string, fallback = ""): string {
  try {
    const ext = path.extname(new URL(url).pathname);
    return ext || fallback;
  } catch {
    return fallback;
  }
}

function isHttpUrl(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\//.test(v);
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

/**
 * Harvest downloadable asset URLs from a Meshy task object. Handles every task
 * shape: model_urls maps, texture_urls arrays, image_urls arrays, thumbnail/video
 * fields, and nested result objects (animation tasks) — via a recursive walk over
 * keys ending in _url / _urls.
 */
export function collectAssets(
  task: Record<string, unknown>,
  opts: { formats?: string[]; includeTextures?: boolean } = {},
): Asset[] {
  const includeTextures = opts.includeTextures ?? true;
  const formats = opts.formats?.map((f) => f.toLowerCase().replace(/^\./, ""));
  const assets: Asset[] = [];
  const seen = new Set<string>();

  const add = (name: string, url: string) => {
    if (seen.has(url)) return;
    seen.add(url);
    assets.push({ name: sanitize(name), url });
  };

  const walk = (node: unknown, keyPath: string[]) => {
    if (node == null) return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, [...keyPath, String(i)]));
      return;
    }
    if (typeof node !== "object") return;

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const inModelUrls = key === "model_urls" || keyPath.includes("model_urls");
      const inTextures = key === "texture_urls" || keyPath.includes("texture_urls");

      if (key === "model_urls" && value && typeof value === "object" && !Array.isArray(value)) {
        for (const [fmt, url] of Object.entries(value as Record<string, unknown>)) {
          if (!isHttpUrl(url)) continue;
          if (formats && !formats.includes(fmt.toLowerCase()) && fmt !== "mtl") continue;
          add(`model.${fmt}`, url);
        }
        continue;
      }

      if (key === "texture_urls") {
        if (!includeTextures) continue;
        const entries = Array.isArray(value) ? value : [value];
        entries.forEach((tex, i) => {
          if (!tex || typeof tex !== "object") return;
          for (const [mapName, url] of Object.entries(tex as Record<string, unknown>)) {
            if (!isHttpUrl(url)) continue;
            const suffix = entries.length > 1 ? `_${i}` : "";
            add(`texture${suffix}_${mapName}${extFromUrl(url, ".png")}`, url);
          }
        });
        continue;
      }

      if (key === "image_urls" && Array.isArray(value)) {
        value.forEach((url, i) => {
          if (isHttpUrl(url)) add(`image_${i}${extFromUrl(url, ".png")}`, url);
        });
        continue;
      }

      if (key.endsWith("_url") && isHttpUrl(value)) {
        const base = key.replace(/_url$/, "");
        if (!includeTextures && inTextures) continue;
        if (formats && inModelUrls) continue;
        add(`${base}${extFromUrl(value, ".png")}`, value);
        continue;
      }

      if (typeof value === "object") {
        walk(value, [...keyPath, key]);
      }
    }
  };

  walk(task, []);
  return assets;
}

export interface DownloadedFile {
  file: string;
  bytes: number;
}

export async function downloadAssets(assets: Asset[], destDir: string): Promise<DownloadedFile[]> {
  const abs = path.resolve(destDir);
  await mkdir(abs, { recursive: true });
  const manifest: DownloadedFile[] = [];

  for (const asset of assets) {
    const res = await fetch(asset.url);
    if (!res.ok || !res.body) {
      throw new Error(`Download failed (${res.status}) for ${asset.name} — URLs expire ~3 days after task completion; re-run the task if expired.`);
    }
    const filePath = path.join(abs, asset.name);
    await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), createWriteStream(filePath));
    const { size } = await stat(filePath);
    manifest.push({ file: filePath, bytes: size });
  }
  return manifest;
}
