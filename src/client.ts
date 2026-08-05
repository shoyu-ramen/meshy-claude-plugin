const BASE_URL = "https://api.meshy.ai";

export const KEY_HELP =
  "MESHY_API_KEY is not set (or was rejected). Create an API key at https://www.meshy.ai/settings/api, " +
  "add `export MESHY_API_KEY=msy_...` to your shell profile, and restart Claude Code so the plugin's MCP server inherits it.";

export class MeshyError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "MeshyError";
  }
}

export function getApiKey(): string | undefined {
  const key = process.env.MESHY_API_KEY?.trim();
  return key ? key : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  return 1000 * 2 ** attempt;
}

function mapError(status: number, detail: string, path: string): string {
  switch (status) {
    case 401:
      return KEY_HELP;
    case 402:
      return `Insufficient Meshy credits. Check remaining credits with get_balance and top up at https://www.meshy.ai/settings (${detail})`;
    case 404:
      return `Not found: ${path}. If this was a task lookup, the task_type probably doesn't match the API group that created the task (${detail})`;
    case 429:
      return `Meshy API rate limit hit; retries exhausted. Wait a moment and try again (${detail})`;
    default:
      return `Meshy API error ${status} on ${path}: ${detail}`;
  }
}

export interface MeshyRequest {
  method?: string;
  body?: unknown;
  retries?: number;
}

export async function meshyFetch<T = any>(path: string, opts: MeshyRequest = {}): Promise<T> {
  const key = getApiKey();
  if (!key) {
    throw new MeshyError(KEY_HELP, 401);
  }

  const retries = opts.retries ?? 2;
  let attempt = 0;

  while (true) {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        method: opts.method ?? "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch (err) {
      if (attempt < retries) {
        await sleep(backoffMs(attempt++));
        continue;
      }
      throw new MeshyError(`Network error calling Meshy API: ${(err as Error).message}`);
    }

    if (res.ok) {
      if (res.status === 204) return null as T;
      const text = await res.text();
      return (text ? JSON.parse(text) : null) as T;
    }

    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      await sleep(backoffMs(attempt++));
      continue;
    }

    const bodyText = await res.text().catch(() => "");
    let detail = bodyText;
    try {
      detail = JSON.parse(bodyText)?.message ?? bodyText;
    } catch {
      // non-JSON error body — keep raw text
    }
    throw new MeshyError(mapError(res.status, detail, path), res.status);
  }
}
