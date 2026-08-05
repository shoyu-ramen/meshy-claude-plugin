import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ok, fail } from "../result.js";
import { createTask } from "./util.js";

const ANIMATION_CATALOG_URL = "https://api.meshy.ai/web/public/animations/resources";

interface CatalogEntry {
  id: number;
  name: string;
  key: string;
  category: string;
  subCategory: string;
  rigType: string;
  isFree: boolean;
}

let catalogCache: CatalogEntry[] | null = null;

async function fetchCatalog(): Promise<CatalogEntry[]> {
  if (catalogCache) return catalogCache;
  const res = await fetch(ANIMATION_CATALOG_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch animation catalog (${res.status}) from ${ANIMATION_CATALOG_URL}`);
  }
  const data = (await res.json()) as { result?: { list?: CatalogEntry[] } };
  const list = data.result?.list;
  if (!list?.length) {
    throw new Error("Animation catalog response had no entries.");
  }
  catalogCache = list;
  return list;
}

export function registerCharacterTools(server: McpServer): void {
  server.registerTool(
    "rig",
    {
      title: "Rig character",
      description:
        "Auto-rig a HUMANOID (bipedal) 3D model for animation. Constraints: clearly defined limbs, ≤300k faces (via input_task_id), character facing +Z, textured mesh. Output: rigged FBX/GLB + basic walk/run. task_type 'rigging'. Follow with `animate`.",
      inputSchema: {
        input_task_id: z
          .string()
          .optional()
          .describe("SUCCEEDED Meshy task id of the character model (takes priority over model_url)"),
        model_url: z.string().optional().describe("Publicly accessible URL or data URI of a .glb"),
        height_meters: z
          .number()
          .positive()
          .optional()
          .describe("Real-world character height for scale accuracy (default 1.7)"),
        texture_image_url: z
          .string()
          .optional()
          .describe("UV-unwrapped base color texture to apply (URL/data URI)"),
      },
    },
    async (args) => {
      try {
        if (!args.input_task_id && !args.model_url) {
          return fail("Provide `input_task_id` or `model_url`.");
        }
        return await createTask("rigging", args);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "animate",
    {
      title: "Animate rigged character",
      description:
        "Apply an animation from Meshy's library (~680 actions) to a completed rigging task. Find action_id with search_animations. task_type 'animation'.",
      inputSchema: {
        rig_task_id: z.string().describe("SUCCEEDED rigging task id"),
        action_id: z.number().int().describe("Animation id from search_animations"),
        post_process: z
          .object({
            operation_type: z
              .enum(["change_fps", "fbx2usdz", "extract_armature"])
              .describe("Optional output post-processing"),
            fps: z.number().int().optional().describe("For change_fps: 24, 25, 30, or 60 (default 30)"),
          })
          .optional(),
      },
    },
    async (args) => {
      try {
        return await createTask("animation", args);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "search_animations",
    {
      title: "Search animation library",
      description:
        "Search Meshy's animation catalog (~680 biped actions: idle, walk, run, fight, dance, …) by keyword. Returns action_id values for `animate`. Free call.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Keyword matched against name/category/subcategory (e.g. 'punch', 'idle', 'dance'). Omit to browse."),
        category: z.string().optional().describe("Exact category filter, e.g. Fighting, WalkAndRun, DailyActions"),
        free_only: z.boolean().optional().describe("Only animations free of extra credit cost"),
        limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20)"),
      },
    },
    async ({ query, category, free_only, limit }) => {
      try {
        const catalog = await fetchCatalog();
        const q = query?.toLowerCase();
        const matches = catalog.filter((a) => {
          if (category && a.category.toLowerCase() !== category.toLowerCase()) return false;
          if (free_only && !a.isFree) return false;
          if (!q) return true;
          return [a.name, a.key, a.category, a.subCategory].some((s) => s?.toLowerCase().includes(q));
        });
        const rows = matches.slice(0, limit ?? 20).map((a) => ({
          action_id: a.id,
          name: a.name,
          category: a.category,
          sub_category: a.subCategory,
          rig_type: a.rigType,
          is_free: a.isFree,
        }));
        return ok({ total_matches: matches.length, showing: rows.length, animations: rows });
      } catch (err) {
        return fail(err);
      }
    },
  );
}
