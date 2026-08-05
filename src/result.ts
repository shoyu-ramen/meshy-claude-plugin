type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function ok(data: unknown): ToolResult {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: "text", text }] };
}

export function fail(err: unknown): ToolResult {
  const msg = err instanceof Error ? err.message : String(err);
  return { isError: true, content: [{ type: "text", text: msg }] };
}
