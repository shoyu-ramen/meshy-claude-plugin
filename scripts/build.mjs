import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: "dist/index.mjs",
  banner: {
    js: "import { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);",
  },
  loader: { ".json": "json" },
  logLevel: "info",
});
