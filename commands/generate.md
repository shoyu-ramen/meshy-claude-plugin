---
description: Generate a textured 3D model from a text prompt (full Meshy preview→refine→download pipeline)
argument-hint: "<prompt> [-- extra options e.g. pbr, 8k, quad, lowpoly]"
---

Generate a 3D model with Meshy from this prompt: $ARGUMENTS

Follow the full pipeline:

1. Call get_balance first; warn if below ~35 credits (preview ≈20 + refine ≈10).
2. Create the preview: text_to_3d {mode: "preview", prompt: <the prompt>} — apply any extra options the user appended (pbr → enable_pbr on refine, 8k → texture_resolution, quad → topology, lowpoly → model_type, a-pose/t-pose → pose_mode).
3. wait_for_task until SUCCEEDED (call again on timeout).
4. Create the refine: text_to_3d {mode: "refine", preview_task_id: <preview id>} with any texture options.
5. wait_for_task until SUCCEEDED.
6. download_assets into ./meshy-assets/<short-slug-of-prompt>/ in the current project (or a directory the user named).
7. Report: credits consumed (preview + refine), downloaded file paths, and the thumbnail path.

If any task FAILS, stop and report task_error.message — do not retry automatically (credits).
