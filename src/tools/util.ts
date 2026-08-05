import { meshyFetch } from "../client.js";
import { endpointFor, type TaskType } from "../registry.js";
import { ok } from "../result.js";

/** POST a create-task request; returns the standard next-step tool result. */
export async function createTask(taskType: TaskType, body: Record<string, unknown>) {
  const clean = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
  const res = await meshyFetch<{ result: string }>(endpointFor(taskType), {
    method: "POST",
    body: clean,
  });
  return ok({
    task_id: res.result,
    task_type: taskType,
    next: `Call wait_for_task {task_type:"${taskType}", task_id:"${res.result}"}; after SUCCEEDED call download_assets (URLs expire ~3 days).`,
  });
}
