import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fail } from "../result.js";
import { createTask } from "./util.js";

const inputTaskId = z
  .string()
  .optional()
  .describe("SUCCEEDED Meshy task id to use as input (takes priority over model_url)");
const modelUrl = z
  .string()
  .optional()
  .describe("Publicly accessible URL or data URI of a model (.glb/.gltf/.obj/.fbx/.stl)");

export function registerProcessTools(server: McpServer): void {
  server.registerTool(
    "process_model",
    {
      title: "Process 3D model",
      description:
        "Mesh processing on an existing model (Meshy task or URL). Operations: remesh (retopologize/decimate, task_type 'remesh'), convert (format conversion only, 'convert'), resize (real-world scaling, 'resize'), uv_unwrap (generate UVs for a .glb ≤40k faces, 'uv-unwrap'). Use the matching task_type when waiting/downloading.",
      inputSchema: {
        operation: z.enum(["remesh", "convert", "resize", "uv_unwrap"]),
        input_task_id: inputTaskId,
        model_url: modelUrl,
        target_formats: z
          .array(z.enum(["glb", "fbx", "obj", "usdz", "blend", "stl", "3mf"]))
          .optional()
          .describe("remesh (default ['glb']) / convert (required)"),
        topology: z.enum(["quad", "triangle"]).optional().describe("remesh only (default triangle)"),
        target_polycount: z.number().int().min(100).max(300000).optional().describe("remesh only (default 30000)"),
        decimation_mode: z
          .number()
          .int()
          .min(1)
          .max(4)
          .optional()
          .describe("remesh only: 1=ultra 2=high 3=medium 4=low quality"),
        resize_height: z.number().positive().optional().describe("resize/remesh: exact height in meters"),
        resize_longest_side: z.number().positive().optional().describe("resize/remesh: longest side in meters"),
        auto_size: z.boolean().optional().describe("resize/remesh: AI-estimated real-world size"),
        origin_at: z.enum(["bottom", "center"]).optional(),
        convert_format_only: z.boolean().optional().describe("remesh: skip retopology, only convert formats"),
        alpha_thumbnail: z.boolean().optional(),
      },
    },
    async ({ operation, ...args }) => {
      try {
        if (!args.input_task_id && !args.model_url) {
          return fail("Provide `input_task_id` or `model_url`.");
        }
        if (operation === "convert" && !args.target_formats?.length) {
          return fail("operation=convert requires `target_formats`.");
        }
        if (operation === "resize") {
          const modes = [args.resize_height, args.resize_longest_side, args.auto_size].filter(
            (v) => v !== undefined && v !== false,
          );
          if (modes.length !== 1) {
            return fail(
              "operation=resize requires exactly one of `resize_height`, `resize_longest_side`, or `auto_size:true`.",
            );
          }
        }
        const taskType = operation === "uv_unwrap" ? "uv-unwrap" : operation;
        if (operation === "uv_unwrap" || operation === "resize") {
          const { target_formats, topology, target_polycount, decimation_mode, convert_format_only, ...rest } =
            args;
          const body =
            operation === "uv_unwrap"
              ? { input_task_id: rest.input_task_id, model_url: rest.model_url }
              : rest;
          return await createTask(taskType, body);
        }
        return await createTask(taskType, args);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "retexture",
    {
      title: "Retexture model",
      description:
        "Generate new textures for an existing model (Meshy task or URL), guided by a style prompt or reference image. task_type 'retexture'.",
      inputSchema: {
        input_task_id: inputTaskId,
        model_url: modelUrl,
        text_style_prompt: z.string().max(600).optional().describe("Texture style description"),
        image_style_url: z
          .string()
          .optional()
          .describe("Style reference image URL/data URI (takes priority over text_style_prompt)"),
        ai_model: z.enum(["meshy-5", "meshy-6", "latest"]).optional(),
        enable_original_uv: z.boolean().optional().describe("Keep the model's existing UV layout (default false)"),
        enable_pbr: z.boolean().optional(),
        texture_resolution: z.enum(["2k", "4k", "8k"]).optional(),
        remove_lighting: z.boolean().optional().describe("Default true"),
        target_formats: z.array(z.enum(["glb", "obj", "fbx", "stl", "usdz", "3mf"])).optional(),
        alpha_thumbnail: z.boolean().optional(),
      },
    },
    async (args) => {
      try {
        if (!args.input_task_id && !args.model_url) {
          return fail("Provide `input_task_id` or `model_url`.");
        }
        if (!args.text_style_prompt && !args.image_style_url) {
          return fail("Provide `text_style_prompt` or `image_style_url`.");
        }
        return await createTask("retexture", args);
      } catch (err) {
        return fail(err);
      }
    },
  );
}
