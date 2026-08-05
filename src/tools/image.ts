import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fail } from "../result.js";
import { createTask } from "./util.js";

const imageAiModel = z
  .enum(["nano-banana", "nano-banana-2", "nano-banana-pro", "gpt-image-2"])
  .describe("Image generation model");
const aspectRatio = z
  .enum(["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"])
  .optional()
  .describe("nano-banana*: 1:1/16:9/9:16/4:3/3:4; gpt-image-2: 1:1/3:2/2:3. Incompatible with generate_multi_view.");

export function registerImageTools(server: McpServer): void {
  server.registerTool(
    "text_to_image",
    {
      title: "Text to image",
      description:
        "Generate an image from text (useful as image_to_3d input — set generate_multi_view for 3 angles). task_type 'text-to-image'.",
      inputSchema: {
        prompt: z.string(),
        ai_model: imageAiModel,
        generate_multi_view: z
          .boolean()
          .optional()
          .describe("Produce 3 viewing angles of one subject (good for multi_image_to_3d)"),
        pose_mode: z.enum(["a-pose", "t-pose"]).optional().describe("Character pose (useful before rigging)"),
        aspect_ratio: aspectRatio,
      },
    },
    async (args) => {
      try {
        if (args.generate_multi_view && args.aspect_ratio) {
          return fail("`generate_multi_view` and `aspect_ratio` cannot be combined.");
        }
        return await createTask("text-to-image", args);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "image_to_image",
    {
      title: "Image to image",
      description:
        "Transform/restyle reference images (1–5) guided by a prompt. task_type 'image-to-image'.",
      inputSchema: {
        prompt: z.string(),
        ai_model: imageAiModel,
        reference_image_urls: z
          .array(z.string())
          .min(1)
          .max(5)
          .describe("1–5 public URLs or base64 data URIs (.jpg/.jpeg/.png)"),
        generate_multi_view: z.boolean().optional(),
        aspect_ratio: aspectRatio,
      },
    },
    async (args) => {
      try {
        if (args.generate_multi_view && args.aspect_ratio) {
          return fail("`generate_multi_view` and `aspect_ratio` cannot be combined.");
        }
        return await createTask("image-to-image", args);
      } catch (err) {
        return fail(err);
      }
    },
  );
}
