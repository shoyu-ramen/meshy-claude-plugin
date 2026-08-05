// Meshy task objects carry huge signed URLs. Agents only need those inside
// download_assets — everywhere else return a compact summary to save context.

function urlKeys(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => typeof v === "string" && v)
    .map(([k]) => k);
}

export function summarizeTask(task: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const copy = [
    "id",
    "type",
    "mode",
    "name",
    "status",
    "progress",
    "prompt",
    "texture_prompt",
    "ai_model",
    "consumed_credits",
    "preceding_tasks",
    "created_at",
    "finished_at",
    "candidate_ids",
    "printability",
  ];
  for (const key of copy) {
    const v = task[key];
    if (v !== undefined && v !== null && v !== "") out[key] = v;
  }
  if (task.task_error && (task.task_error as { message?: string }).message) {
    out.task_error = task.task_error;
  }

  const availableAssets: Record<string, unknown> = {};
  if (task.model_urls) {
    const formats = urlKeys(task.model_urls);
    if (formats.length) availableAssets.model_formats = formats;
  }
  if (Array.isArray(task.texture_urls) && task.texture_urls.length) {
    availableAssets.texture_maps = [...new Set(task.texture_urls.flatMap(urlKeys))];
  }
  if (Array.isArray(task.image_urls) && task.image_urls.length) {
    availableAssets.image_count = task.image_urls.length;
  }
  if (task.result && typeof task.result === "object") {
    const animUrls = urlKeys(task.result).filter((k) => k.endsWith("_url"));
    if (animUrls.length) availableAssets.animation_outputs = animUrls;
  }
  if (typeof task.thumbnail_url === "string" && task.thumbnail_url) {
    availableAssets.thumbnail = true;
  }
  if (Object.keys(availableAssets).length) {
    out.available_assets = availableAssets;
    out.note = "Use download_assets to save files locally; URLs omitted here to keep output small.";
  }
  return out;
}
