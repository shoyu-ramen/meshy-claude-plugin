import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CREATIVE_LAB_PRODUCT_VALUES, type TaskType } from "../registry.js";
import { fail } from "../result.js";
import { createTask } from "./util.js";

const OPTIONS_HELP = [
  "Build options per product:",
  "keychain/fridge-magnet: badge_shape (circle|rounded-rect|hexagon|shield|star), size_mm, relief_height_mm, relief_offset_mm, base_thickness_mm, has_closed_back, relief_curve (linear|gamma|s-curve), curve_param, invert_depth, smoothing, relief_scale, depth_threshold, remove_background, export_resolution",
  "lamp: diameter_mm (50-400, default 80), thickness_mm, cut_amount_percent, light_source_preset (bambu_mh001_60mm|none), fixture_offset_x_mm, fixture_offset_z_mm, rotate_x_deg/rotate_y_deg/rotate_z_deg, include_result_json",
  "keycap: base_model (default cherry-mx-1x1-r1), head_size_mm (10-40), vertical_offset_mm (-5..5)",
  "figure/vinyl-figure/brick-figure: no options",
].join(" ");

export function registerCreativeLabTools(server: McpServer): void {
  server.registerTool(
    "creative_lab",
    {
      title: "Creative Lab product generator",
      description:
        "Generate printable products from an image via Meshy Creative Lab. Two-phase: stage=prototype turns an image (lamp: image or text) into concept image(s); stage=build turns a SUCCEEDED prototype into the 3D artifact. task_type is stage-qualified: e.g. keychain-prototype, keychain-build.",
      inputSchema: {
        product: z.enum(CREATIVE_LAB_PRODUCT_VALUES),
        stage: z.enum(["prototype", "build"]),
        image_url: z
          .string()
          .optional()
          .describe("prototype: source photo URL or data URI (.jpg/.jpeg/.png/.webp)"),
        text: z.string().max(800).optional().describe("prototype, lamp only: text prompt instead of image_url"),
        image_subject: z
          .enum(["character", "landscape"])
          .optional()
          .describe("prototype, lamp only (default character)"),
        input_task_id: z.string().optional().describe("build: SUCCEEDED prototype task id (required)"),
        candidate_id: z
          .string()
          .optional()
          .describe("build, keycap only: candidate from the prototype's candidate_ids (required)"),
        name: z.string().max(100).optional().describe("Task label"),
        options: z.record(z.unknown()).optional().describe(OPTIONS_HELP),
        output_format: z
          .string()
          .optional()
          .describe("build output format — keychain/fridge-magnet: glb|obj|zip (default glb); lamp: stl|zip (default stl)"),
      },
    },
    async ({ product, stage, image_url, text, image_subject, input_task_id, candidate_id, name, options, output_format }) => {
      try {
        const taskType = `${product}-${stage}` as TaskType;
        if (stage === "prototype") {
          if (product === "lamp") {
            if (!image_url && !text) return fail("lamp prototype requires `image_url` or `text`.");
          } else if (!image_url) {
            return fail(`${product} prototype requires \`image_url\`.`);
          }
          return await createTask(taskType, { image_url, text, image_subject, name });
        }
        if (!input_task_id) return fail("stage=build requires `input_task_id` of a SUCCEEDED prototype.");
        if (product === "keycap" && !candidate_id) {
          return fail("keycap build requires `candidate_id` (see the prototype task's candidate_ids).");
        }
        const body: Record<string, unknown> = { input_task_id, candidate_id, name, options };
        if (output_format) body.output = { format: output_format };
        return await createTask(taskType, body);
      } catch (err) {
        return fail(err);
      }
    },
  );
}
