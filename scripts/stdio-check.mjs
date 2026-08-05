// Quick JSON-RPC handshake against the built server: initialize + tools/list.
// Usage: node scripts/stdio-check.mjs [--call <tool> <json-args>]
import { spawn } from "node:child_process";

const proc = spawn("node", ["dist/index.mjs"], { stdio: ["pipe", "pipe", "inherit"] });
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

function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 15000);
  });
}

const init = await rpc("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "stdio-check", version: "0.0.0" },
});
console.log("server:", init.result.serverInfo);
proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

const tools = await rpc("tools/list", {});
console.log(`tools (${tools.result.tools.length}):`, tools.result.tools.map((t) => t.name).join(", "));

const callIdx = process.argv.indexOf("--call");
if (callIdx > 0) {
  const name = process.argv[callIdx + 1];
  const args = JSON.parse(process.argv[callIdx + 2] ?? "{}");
  const res = await rpc("tools/call", { name, arguments: args });
  console.log("call result:", JSON.stringify(res.result ?? res.error, null, 2));
}

proc.kill();
process.exit(0);
