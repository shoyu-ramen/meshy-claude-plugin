import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIST = path.resolve(__dirname, "../dist/index.mjs");

const EXPECTED_TOOLS = [
  "text_to_3d",
  "image_to_3d",
  "multi_image_to_3d",
  "process_model",
  "retexture",
  "rig",
  "animate",
  "search_animations",
  "text_to_image",
  "image_to_image",
  "printing",
  "creative_lab",
  "get_task",
  "list_tasks",
  "delete_task",
  "wait_for_task",
  "download_assets",
  "get_balance",
].sort();

describe("stdio server (built bundle)", () => {
  it.skipIf(!existsSync(DIST))("initializes and lists exactly the 18 expected tools", async () => {
    const proc = spawn("node", [DIST], { stdio: ["pipe", "pipe", "ignore"] });
    const pending = new Map<number, (msg: any) => void>();
    let buf = "";
    proc.stdout.on("data", (chunk) => {
      buf += chunk.toString();
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        const msg = JSON.parse(line);
        if (msg.id !== undefined) pending.get(msg.id)?.(msg);
      }
    });
    const rpc = (id: number, method: string, params: unknown) =>
      new Promise<any>((resolve, reject) => {
        pending.set(id, resolve);
        proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
        setTimeout(() => reject(new Error(`timeout: ${method}`)), 10000);
      });

    try {
      const init = await rpc(1, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "0" },
      });
      expect(init.result.serverInfo.name).toBe("meshy");
      proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

      const tools = await rpc(2, "tools/list", {});
      const names = tools.result.tools.map((t: { name: string }) => t.name).sort();
      expect(names).toEqual(EXPECTED_TOOLS);

      for (const tool of tools.result.tools) {
        expect(tool.description?.length ?? 0).toBeGreaterThan(20);
      }
    } finally {
      proc.kill();
    }
  });
});
