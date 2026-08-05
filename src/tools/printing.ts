import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fail } from "../result.js";
import { createTask } from "./util.js";

export function registerPrintingTools(server: McpServer): void {
  server.registerTool(
    "printing",
    {
      title: "3D-print preparation",
      description:
        "Prepare a model for 3D printing. Operations: analyze (printability report: watertightness, holes, non-manifold edges — task_type 'analyze-printability'), repair (fix mesh issues — 'repair-printability'), multi_color (generate multi-color 3MF — 'multi-color-print'). Input: SUCCEEDED Meshy task (Meshy-6+ for analyze) or model URL.",
      inputSchema: {
        operation: z.enum(["analyze", "repair", "multi_color"]),
        input_task_id: z
          .string()
          .optional()
          .describe("SUCCEEDED task id from text/image/multi-image-to-3d, remesh, or retexture (takes priority)"),
        model_url: z
          .string()
          .optional()
          .describe("Model URL or data URI (.glb/.gltf/.obj/.fbx/.stl, ≤100MB; multi_color: .glb/.fbx)"),
        max_colors: z.number().int().min(1).max(16).optional().describe("multi_color only (default 4)"),
        alpha_thumbnail: z.boolean().optional().describe("repair only"),
      },
    },
    async ({ operation, ...args }) => {
      try {
        if (!args.input_task_id && !args.model_url) {
          return fail("Provide `input_task_id` or `model_url`.");
        }
        const taskType =
          operation === "analyze"
            ? "analyze-printability"
            : operation === "repair"
              ? "repair-printability"
              : "multi-color-print";
        const body: Record<string, unknown> = {
          input_task_id: args.input_task_id,
          model_url: args.model_url,
        };
        if (operation === "multi_color") body.max_colors = args.max_colors;
        if (operation === "repair") body.alpha_thumbnail = args.alpha_thumbnail;
        return await createTask(taskType, body);
      } catch (err) {
        return fail(err);
      }
    },
  );
}
