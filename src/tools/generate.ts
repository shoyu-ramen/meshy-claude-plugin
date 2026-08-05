import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fail } from "../result.js";
import { createTask } from "./util.js";

const aiModel = z
  .enum(["meshy-5", "meshy-6", "latest"])
  .optional()
  .describe("Generation model (default latest)");
const targetFormats = z
  .array(z.enum(["glb", "obj", "fbx", "stl", "usdz", "3mf"]))
  .optional()
  .describe("Limit output formats — fewer formats finish faster (default: all except 3mf)");
const textureResolution = z.enum(["2k", "4k", "8k"]).optional().describe("Texture resolution (default 2k)");
const topology = z.enum(["quad", "triangle"]).optional().describe("Mesh topology (default triangle)");
const targetPolycount = z
  .number()
  .int()
  .min(100)
  .max(300000)
  .optional()
  .describe("Target polygon count, 100–300000 (default 30000)");
const poseMode = z.enum(["a-pose", "t-pose"]).optional().describe("Force character pose (useful before rigging)");
const originAt = z.enum(["bottom", "center"]).optional().describe("Model origin placement (default bottom)");
const imageUrl = z.string().describe("Publicly accessible URL or base64 data URI (.jpg/.jpeg/.png)");

export function registerGenerateTools(server: McpServer): void {
  server.registerTool(
    "text_to_3d",
    {
      title: "Text to 3D",
      description:
        "Create a Meshy text-to-3D task. Two-stage workflow: mode=preview generates an UNTEXTURED mesh from a prompt; mode=refine textures a SUCCEEDED preview task (requires preview_task_id). Typical flow: preview → wait → refine → wait → download_assets.",
      inputSchema: {
        mode: z.enum(["preview", "refine"]),
        prompt: z.string().max(600).optional().describe("Object description, ≤600 chars. Required for preview."),
        preview_task_id: z.string().optional().describe("SUCCEEDED preview task id. Required for refine."),
        ai_model: aiModel,
        model_type: z.enum(["standard", "lowpoly"]).optional().describe("Preview only (default standard)"),
        topology,
        target_polycount: targetPolycount,
        should_remesh: z.boolean().optional().describe("Preview only. Default: false on meshy-6, true otherwise"),
        symmetry_mode: z.enum(["off", "auto", "on"]).optional().describe("Preview only (default auto)"),
        pose_mode: poseMode,
        enable_pbr: z.boolean().optional().describe("Refine only: generate metallic/roughness/normal maps"),
        texture_resolution: textureResolution,
        texture_prompt: z.string().max(600).optional().describe("Refine only: extra texture guidance"),
        texture_image_url: z.string().optional().describe("Refine only: texture reference image URL/data URI"),
        remove_lighting: z.boolean().optional().describe("Refine only: strip baked lighting (default true)"),
        target_formats: targetFormats,
        origin_at: originAt,
        auto_size: z.boolean().optional().describe("Scale to real-world size (default false)"),
        moderation: z.boolean().optional(),
      },
    },
    async (args) => {
      try {
        if (args.mode === "preview" && !args.prompt) {
          return fail("mode=preview requires `prompt`.");
        }
        if (args.mode === "refine" && !args.preview_task_id) {
          return fail("mode=refine requires `preview_task_id` of a SUCCEEDED preview task.");
        }
        return await createTask("text-to-3d", args);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "image_to_3d",
    {
      title: "Image to 3D",
      description:
        "Create a Meshy image-to-3D task from one image (or a completed text_to_image/image_to_image task). Single stage — texturing included unless should_texture=false.",
      inputSchema: {
        image_url: imageUrl.optional(),
        input_task_id: z
          .string()
          .optional()
          .describe("Alternative input: SUCCEEDED text-to-image / image-to-image task id"),
        ai_model: z.enum(["meshy-5", "meshy-6", "latest", "meshy-t1", "meshy-t2"]).optional(),
        model_type: z
          .enum(["standard", "smart-topology", "lowpoly"])
          .optional()
          .describe("Mesh style (default standard)"),
        should_texture: z.boolean().optional().describe("Generate textures (default true)"),
        enable_pbr: z.boolean().optional(),
        texture_resolution: textureResolution,
        texture_prompt: z.string().max(600).optional(),
        texture_image_url: z.string().optional(),
        should_remesh: z.boolean().optional(),
        topology,
        target_polycount: targetPolycount,
        save_pre_remeshed_model: z.boolean().optional(),
        pose_mode: poseMode,
        image_enhancement: z.boolean().optional().describe("Default true"),
        remove_lighting: z.boolean().optional().describe("Default true"),
        target_formats: targetFormats,
        origin_at: originAt,
        auto_size: z.boolean().optional(),
        alpha_thumbnail: z.boolean().optional(),
        multi_view_thumbnails: z.boolean().optional(),
        moderation: z.boolean().optional(),
      },
    },
    async (args) => {
      try {
        if (!args.image_url && !args.input_task_id) {
          return fail("Provide `image_url` or `input_task_id`.");
        }
        return await createTask("image-to-3d", args);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "multi_image_to_3d",
    {
      title: "Multi-image to 3D",
      description:
        "Create a Meshy 3D model from 1–4 images of the same object (different angles improve fidelity), or from a completed image-generation task.",
      inputSchema: {
        image_urls: z.array(imageUrl).min(1).max(4).optional(),
        input_task_id: z.string().optional().describe("Alternative input: SUCCEEDED image-generation task id"),
        ai_model: aiModel,
        should_texture: z.boolean().optional().describe("Default true"),
        enable_pbr: z.boolean().optional(),
        texture_resolution: textureResolution,
        texture_prompt: z.string().max(600).optional(),
        texture_image_url: z.string().optional(),
        should_remesh: z.boolean().optional(),
        topology,
        target_polycount: targetPolycount,
        save_pre_remeshed_model: z.boolean().optional(),
        pose_mode: poseMode,
        image_enhancement: z.boolean().optional().describe("Default true"),
        remove_lighting: z.boolean().optional().describe("Default true"),
        target_formats: targetFormats,
        origin_at: originAt,
        auto_size: z.boolean().optional(),
        alpha_thumbnail: z.boolean().optional(),
        multi_view_thumbnails: z.boolean().optional(),
        moderation: z.boolean().optional(),
      },
    },
    async (args) => {
      try {
        if (!args.image_urls?.length && !args.input_task_id) {
          return fail("Provide `image_urls` (1–4) or `input_task_id`.");
        }
        return await createTask("multi-image-to-3d", args);
      } catch (err) {
        return fail(err);
      }
    },
  );
}
