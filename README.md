# Meshy 3D — Claude Code plugin

Generate 3D models, textures, rigs, animations, and 3D-print files from any Claude Code session via the [Meshy AI API](https://docs.meshy.ai/en/api).

## Install

1. Get an API key at [meshy.ai/settings/api](https://www.meshy.ai/settings/api) and export it (shell profile):

   ```sh
   export MESHY_API_KEY=msy_...
   ```

2. Add the marketplace and install (restart Claude Code first if you just set the env var):

   ```
   /plugin marketplace add shoyu-ramen/meshy-claude-plugin
   /plugin install meshy@meshy-marketplace
   ```

   From a local clone instead: `/plugin marketplace add /path/to/meshy-claude-plugin`

## What you get

**18 MCP tools** (`mcp__plugin_meshy_meshy__*`):

| Group | Tools |
|---|---|
| Generate 3D | `text_to_3d` (preview→refine), `image_to_3d`, `multi_image_to_3d` |
| Process | `process_model` (remesh/convert/resize/uv_unwrap), `retexture` |
| Characters | `rig`, `animate`, `search_animations` (~680-action catalog) |
| Images | `text_to_image`, `image_to_image` |
| 3D printing | `printing` (analyze/repair/multi_color) |
| Creative Lab | `creative_lab` (keychain, fridge-magnet, figure, vinyl-figure, brick-figure, lamp, keycap) |
| Tasks | `get_task`, `list_tasks`, `delete_task`, `wait_for_task` |
| Utility | `download_assets`, `get_balance` |

**Slash commands**: `/meshy:generate "<prompt>"` (full pipeline incl. download), `/meshy:balance`.

**Skill**: workflow guidance (two-stage text-to-3D, character rig+animate pipeline, credit costs, 3-day URL expiry) loads automatically when relevant.

## Usage notes

- All generations are async tasks: create → `wait_for_task` → `download_assets`. Output URLs **expire ~3 days** after completion — download promptly.
- `analyze-printability` and `search_animations` are free; `get_balance` shows remaining credits.
- Task summaries omit signed URLs to keep agent context small; `raw: true` returns full objects.

## Development

```sh
npm install
npm run build       # bundle src/ → dist/index.mjs (committed — plugins run no install step)
npm run typecheck
npm test
node scripts/stdio-check.mjs                 # handshake + tools/list
node scripts/stdio-check.mjs --call get_balance '{}'
npm run inspect     # MCP inspector UI
```

`src/registry.ts` maps every `task_type` to its API path — generic task tools and `download_assets` work across all 29 task types from that single table.
