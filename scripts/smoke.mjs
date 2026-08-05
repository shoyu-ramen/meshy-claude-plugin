// Live smoke test — BURNS ~20 CREDITS (one text-to-3d preview task).
// Gated: MESHY_SMOKE=1 npm run smoke   (requires MESHY_API_KEY)
// Flow: balance → text_to_3d preview → wait_for_task → download_assets → delete_task
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

if (process.env.MESHY_SMOKE !== "1") {
  console.log("Skipping live smoke (set MESHY_SMOKE=1 to run — burns ~20 credits).");
  process.exit(0);
}

const proc = spawn("node", [new URL("../dist/index.mjs", import.meta.url).pathname], {
  stdio: ["pipe", "pipe", "inherit"],
});
const pending = new Map();
let nextId = 1;
let buf = "";
proc.stdout.on("data", (chunk) => {
  buf += chunk.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

function rpc(method, params, timeoutMs = 400000) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), timeoutMs);
  });
}

const call = async (name, args, timeoutMs) => {
  const res = await rpc("tools/call", { name, arguments: args }, timeoutMs);
  const text = res.result?.content?.[0]?.text ?? JSON.stringify(res);
  if (res.result?.isError) throw new Error(`${name} failed: ${text}`);
  console.log(`\n== ${name} ==\n${text.slice(0, 1200)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

await rpc("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "smoke", version: "0" },
});
proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

const { balance } = await call("get_balance", {});
if (balance < 25) throw new Error(`Balance ${balance} too low for smoke (needs ~20).`);

const created = await call("text_to_3d", {
  mode: "preview",
  prompt: "small low-poly rubber duck, smoke test",
  target_formats: ["glb"],
});

const waited = await call(
  "wait_for_task",
  { task_type: "text-to-3d", task_id: created.task_id, timeout_seconds: 360 },
  380000,
);
if (waited.status && waited.status !== "SUCCEEDED") {
  throw new Error(`Preview did not succeed in time: ${JSON.stringify(waited)}`);
}

const dest = mkdtempSync(path.join(tmpdir(), "meshy-smoke-"));
const dl = await call("download_assets", {
  task_type: "text-to-3d",
  task_id: created.task_id,
  dest_dir: dest,
});
if (!dl.downloaded?.length || dl.downloaded.some((f) => f.bytes === 0)) {
  throw new Error("Download produced no files or zero-byte files.");
}

await call("delete_task", { task_type: "text-to-3d", task_id: created.task_id });

console.log(`\nSMOKE PASSED — ${dl.downloaded.length} files in ${dest}`);
proc.kill();
process.exit(0);
