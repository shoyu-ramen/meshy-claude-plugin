import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { meshyFetch } from "../client.js";
import { collectAssets, downloadAssets } from "../download.js";
import { getTask } from "../poll.js";
import { TASK_TYPE_VALUES, type TaskType } from "../registry.js";
import { ok, fail } from "../result.js";

export function registerMiscTools(server: McpServer): void {
  server.registerTool(
    "download_assets",
    {
      title: "Download Meshy task assets",
      description:
        "Download all output files of a SUCCEEDED Meshy task (models, textures, thumbnails, images) to a local directory. Do this promptly — Meshy output URLs expire ~3 days after completion. Returns an absolute-path manifest.",
      inputSchema: {
        task_type: z.enum(TASK_TYPE_VALUES),
        task_id: z.string(),
        dest_dir: z
          .string()
          .optional()
          .describe(
            "Destination directory (created if missing). Pass an explicit project path; default ./meshy-assets/<task_type>-<id-prefix>/ relative to the server's cwd.",
          ),
        formats: z
          .array(z.string())
          .optional()
          .describe("Only download these model formats (e.g. ['glb']). Omit for all."),
        include_textures: z.boolean().optional().describe("Also download texture maps (default true)"),
      },
    },
    async ({ task_type, task_id, dest_dir, formats, include_textures }) => {
      try {
        const task = await getTask(task_type as TaskType, task_id);
        if (task.status !== "SUCCEEDED") {
          return fail(
            `Task ${task_id} is ${task.status}${task.progress != null ? ` (${task.progress}%)` : ""} — assets are only available once SUCCEEDED.` +
              (task.status === "FAILED" ? ` Error: ${task.task_error?.message ?? "unknown"}` : ""),
          );
        }
        const assets = collectAssets(task, { formats, includeTextures: include_textures ?? true });
        if (assets.length === 0) {
          return fail(`Task ${task_id} has no downloadable assets matching the requested filters.`);
        }
        const dest = dest_dir ?? path.join("meshy-assets", `${task_type}-${task_id.slice(0, 8)}`);
        const manifest = await downloadAssets(assets, dest);
        return ok({ downloaded: manifest, dest_dir: path.resolve(dest) });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "get_balance",
    {
      title: "Meshy credit balance",
      description:
        "Get the remaining Meshy API credit balance for the configured account. Free call — check before expensive generations.",
      inputSchema: {},
    },
    async () => {
      try {
        const data = await meshyFetch("/openapi/v1/balance");
        return ok(data);
      } catch (err) {
        return fail(err);
      }
    },
  );
}
