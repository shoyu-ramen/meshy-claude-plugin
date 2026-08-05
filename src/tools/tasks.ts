import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { meshyFetch } from "../client.js";
import { endpointFor, TASK_TYPE_VALUES, type TaskType } from "../registry.js";
import { getTask, waitForTask } from "../poll.js";
import { ok, fail } from "../result.js";
import { summarizeTask } from "../summarize.js";

const rawFlag = z
  .boolean()
  .optional()
  .describe("Return the full task object incl. signed asset URLs (default false: compact summary)");

const taskTypeSchema = z
  .enum(TASK_TYPE_VALUES)
  .describe(
    "API group that created the task. Creative Lab tasks are stage-qualified, e.g. keychain-prototype / keychain-build.",
  );

export function registerTaskTools(server: McpServer): void {
  server.registerTool(
    "get_task",
    {
      title: "Get Meshy task",
      description:
        "Retrieve a Meshy task's status, progress, and output URLs. Statuses: PENDING → IN_PROGRESS → SUCCEEDED | FAILED | CANCELED. Prefer wait_for_task to block until done.",
      inputSchema: {
        task_type: taskTypeSchema,
        task_id: z.string().describe("Task id returned by a create tool"),
        raw: rawFlag,
      },
    },
    async ({ task_type, task_id, raw }) => {
      try {
        const task = await getTask(task_type as TaskType, task_id);
        if (task.status === "FAILED") {
          return fail(
            `Task ${task_id} FAILED: ${task.task_error?.message ?? "no error message"}\n` +
              JSON.stringify(summarizeTask(task), null, 2),
          );
        }
        return ok(raw ? task : summarizeTask(task));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List Meshy tasks",
      description: "List recent Meshy tasks of one type, newest first. Paginated.",
      inputSchema: {
        task_type: taskTypeSchema,
        page_num: z.number().int().min(1).optional().describe("Page number, 1-based (default 1)"),
        page_size: z.number().int().min(1).max(50).optional().describe("Items per page (default 10)"),
        raw: rawFlag,
      },
    },
    async ({ task_type, page_num, page_size, raw }) => {
      try {
        const params = new URLSearchParams({
          page_num: String(page_num ?? 1),
          page_size: String(page_size ?? 10),
          sort_by: "-created_at",
        });
        const tasks = await meshyFetch(`${endpointFor(task_type as TaskType)}?${params}`);
        if (!raw && Array.isArray(tasks)) {
          return ok(tasks.map(summarizeTask));
        }
        return ok(tasks);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete Meshy task",
      description:
        "Permanently delete a Meshy task (cancels if still PENDING — credits refunded only for PENDING Creative Lab tasks). Irreversible.",
      inputSchema: {
        task_type: taskTypeSchema,
        task_id: z.string(),
      },
    },
    async ({ task_type, task_id }) => {
      try {
        await meshyFetch(`${endpointFor(task_type as TaskType)}/${task_id}`, { method: "DELETE" });
        return ok(`Deleted ${task_type} task ${task_id}.`);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "wait_for_task",
    {
      title: "Wait for Meshy task",
      description:
        "Block until a Meshy task reaches a terminal status (SUCCEEDED/FAILED/CANCELED), polling every 5s with progress updates. On timeout returns current status without error — call again to keep waiting. After SUCCEEDED, use download_assets promptly (output URLs expire ~3 days).",
      inputSchema: {
        task_type: taskTypeSchema,
        task_id: z.string(),
        timeout_seconds: z
          .number()
          .int()
          .min(5)
          .max(3600)
          .optional()
          .describe("Max seconds to wait before returning current state (default 300)"),
        poll_interval_seconds: z.number().int().min(2).max(60).optional().describe("Poll cadence (default 5)"),
      },
    },
    async ({ task_type, task_id, timeout_seconds, poll_interval_seconds }, extra) => {
      try {
        const progressToken = extra._meta?.progressToken;
        const { timedOut, task } = await waitForTask(task_type as TaskType, task_id, {
          timeoutSeconds: timeout_seconds ?? 300,
          pollIntervalSeconds: poll_interval_seconds ?? 5,
          onProgress:
            progressToken === undefined
              ? undefined
              : async (progress, message) => {
                  await extra.sendNotification({
                    method: "notifications/progress",
                    params: { progressToken, progress, total: 100, message },
                  });
                },
        });

        if (timedOut) {
          return ok({
            status: task.status,
            progress: task.progress ?? 0,
            hint: `Still running after ${timeout_seconds ?? 300}s — call wait_for_task again with the same arguments to keep waiting.`,
            task_id,
            task_type,
          });
        }
        if (task.status === "FAILED") {
          return fail(
            `Task ${task_id} FAILED: ${task.task_error?.message ?? "no error message"}\n` +
              JSON.stringify(summarizeTask(task), null, 2),
          );
        }
        if (task.status === "CANCELED") {
          return fail(`Task ${task_id} was CANCELED.`);
        }
        return ok(summarizeTask(task));
      } catch (err) {
        return fail(err);
      }
    },
  );
}
