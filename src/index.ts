import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerCharacterTools } from "./tools/character.js";
import { registerCreativeLabTools } from "./tools/creative-lab.js";
import { registerGenerateTools } from "./tools/generate.js";
import { registerImageTools } from "./tools/image.js";
import { registerMiscTools } from "./tools/misc.js";
import { registerPrintingTools } from "./tools/printing.js";
import { registerProcessTools } from "./tools/process.js";
import { registerTaskTools } from "./tools/tasks.js";

const server = new McpServer({ name: "meshy", version: "0.1.0" });

registerGenerateTools(server);
registerProcessTools(server);
registerCharacterTools(server);
registerImageTools(server);
registerPrintingTools(server);
registerCreativeLabTools(server);
registerTaskTools(server);
registerMiscTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
