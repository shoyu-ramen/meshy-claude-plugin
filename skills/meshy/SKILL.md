---
name: meshy
description: Workflows for generating 3D assets with the Meshy plugin tools — text/image to 3D, texturing, rigging + animation pipelines, credit costs, and download rules. Use when generating 3D models, characters, animations, textures, or 3D-print files via Meshy.
---

# Meshy 3D generation workflows

All Meshy operations are **async tasks**: a create tool returns a `task_id` instantly; generation takes seconds to minutes. Standard loop for every task:

1. Create (`text_to_3d`, `image_to_3d`, `rig`, …) → get `task_id` + `task_type`.
2. `wait_for_task {task_type, task_id}` — blocks with progress, default 300s timeout. On timeout it returns current progress without error; call it again to keep waiting.
3. `download_assets {task_type, task_id, dest_dir}` — **always do this promptly after SUCCEEDED**: Meshy file URLs expire ~3 days (non-Enterprise), then the outputs are gone. Pass an explicit `dest_dir` inside the user's project.

Check `get_balance` before expensive runs (free call). Task records are queryable with `get_task` / `list_tasks`; both return compact summaries — pass `raw: true` only if you truly need signed URLs.

## Text → 3D (two stages)

- `text_to_3d {mode: "preview", prompt}` → untextured mesh. 20 credits (meshy-6/lowpoly; 5 on older models).
- Inspect result (thumbnail), then `text_to_3d {mode: "refine", preview_task_id}` → textured. 10 credits (2k/4k), 15 (8k). `enable_pbr: true` for metallic/roughness/normal maps.
- Preview prompt ≤600 chars. Refine only textures the geometry — bad shape? Fix the preview prompt, not refine.
- Fewer `target_formats` = faster completion.

## Image → 3D

- `image_to_3d {image_url}` — public URL or base64 data URI (jpg/png). 30 credits with texture on meshy-6; `should_texture: false` → 20.
- Multiple angles of one object → `multi_image_to_3d {image_urls: [1–4]}`.
- No local file URL support — encode local files as `data:image/png;base64,...`.
- Chain from generated images: `text_to_image {generate_multi_view: true}` (3 angles) → `multi_image_to_3d {input_task_id}`.

## Character pipeline (generate → rig → animate)

1. Generate a **humanoid** model: use `pose_mode: "a-pose"` or `"t-pose"` in the create call — rigging needs clear limbs.
2. `rig {input_task_id, height_meters}` — 5 credits. Constraints: bipedal humanoid only, ≤300k faces, textured, facing +Z. Output includes basic walk/run.
3. `search_animations {query}` → pick `action_id` from ~680-action catalog (free).
4. `animate {rig_task_id, action_id}` — 3 credits each. `post_process` for fps change / USDZ / armature extraction.
5. Download rigged + animated FBX/GLB.

## Mesh processing

- `process_model {operation: "remesh"}` — retopologize/decimate (5 cr). `convert` — format-only (1 cr, `target_formats` required, supports blend). `resize` — real-world scale, exactly one of resize_height / resize_longest_side / auto_size (1 cr). `uv_unwrap` — .glb ≤40k faces (5 cr).
- `retexture {input_task_id, text_style_prompt | image_style_url}` — new textures on existing geometry (10 cr).

## 3D printing

`printing {operation: "analyze"}` — printability report (watertight, holes, non-manifold) — **free**. `repair` fixes issues (10 cr). `multi_color` makes a multi-color 3MF (10 cr, `max_colors` ≤16).

## Creative Lab (physical products from a photo)

Two-phase: `creative_lab {product, stage: "prototype", image_url}` (6 cr; keycap 12) → wait → `{stage: "build", input_task_id}` (30 cr; keycap 50, needs `candidate_id` from prototype). Products: keychain, fridge-magnet, figure, vinyl-figure, brick-figure, lamp (also accepts `text` instead of image), keycap. task_type is stage-qualified: `keychain-prototype`, `keychain-build`, …

## Image generation

`text_to_image` / `image_to_image` — nano-banana (3 cr), nano-banana-2 (6), nano-banana-pro (9), gpt-image-2 (9/12). `generate_multi_view: true` yields 3 angles for the multi-image 3D flow (incompatible with `aspect_ratio`).

## Failure handling

- FAILED tasks surface `task_error.message` verbatim. Rigging failures: usually non-humanoid shape or face count. Refine failures: check `preview_task_id` points to a SUCCEEDED preview.
- 401: MESHY_API_KEY missing/invalid — create at https://www.meshy.ai/settings/api, export in shell profile, restart Claude Code.
- 402: out of credits — `get_balance`, top up at https://www.meshy.ai/settings/subscription.
