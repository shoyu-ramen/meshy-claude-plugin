import { meshyFetch } from "./client.js";
import { endpointFor, type TaskType } from "./registry.js";

export interface MeshyTask {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED";
  progress?: number;
  task_error?: { message?: string } | null;
  [key: string]: unknown;
}

export type ProgressReporter = (progress: number, message: string) => Promise<void>;

const TERMINAL = new Set(["SUCCEEDED", "FAILED", "CANCELED"]);

export function isTerminal(status: string): boolean {
  return TERMINAL.has(status);
}

export async function getTask(taskType: TaskType, taskId: string): Promise<MeshyTask> {
  return meshyFetch<MeshyTask>(`${endpointFor(taskType)}/${taskId}`);
}

export interface WaitResult {
  timedOut: boolean;
  task: MeshyTask;
}

export async function waitForTask(
  taskType: TaskType,
  taskId: string,
  opts: {
    timeoutSeconds: number;
    pollIntervalSeconds: number;
    onProgress?: ProgressReporter;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<WaitResult> {
  const sleep = opts.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const deadline = Date.now() + opts.timeoutSeconds * 1000;

  let task = await getTask(taskType, taskId);
  while (!isTerminal(task.status)) {
    if (opts.onProgress) {
      const queued =
        task.status === "PENDING" && typeof task.preceding_tasks === "number"
          ? ` (${task.preceding_tasks} tasks ahead in queue)`
          : "";
      await opts.onProgress(task.progress ?? 0, `${taskType} ${task.status}${queued}`);
    }
    if (Date.now() >= deadline) {
      return { timedOut: true, task };
    }
    const remaining = deadline - Date.now();
    await sleep(Math.min(opts.pollIntervalSeconds * 1000, remaining));
    task = await getTask(taskType, taskId);
  }
  return { timedOut: false, task };
}
