import "dotenv/config";
import process, { argv, env, exit } from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { Claude } from "./core/claude.js";
import { MCPClient } from "./mcpClient.js";
import { CliChat } from "./core/cliChat.js";
import { CliApp } from "./core/cli.js";

function requireEnv(name: string): string {
  const value = env[name] ?? "";
  if (!value) {
    console.error(`Error: ${name} cannot be empty. Update .env`);
    exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const claudeModel = requireEnv("CLAUDE_MODEL");
  requireEnv("ANTHROPIC_API_KEY");

  const claudeService = new Claude(claudeModel);

  // Resolve the bundled DocumentMCP server relative to this entry file so it
  // works whether running compiled (dist/main.js -> dist/mcpServer.js) or via
  // tsx (src/main.ts -> src/mcpServer.js, which tsx resolves to .ts).
  const here = dirname(fileURLToPath(import.meta.url));
  const serverScript = join(here, "mcpServer.js");

  const serverScripts = argv.slice(2);
  const clients: Record<string, MCPClient> = {};

  const docClient = new MCPClient({
    command: process.execPath,
    args: [serverScript],
  });
  await docClient.connect();
  clients["doc_client"] = docClient;

  for (let i = 0; i < serverScripts.length; i++) {
    const script = serverScripts[i];
    const client = new MCPClient({
      command: process.execPath,
      args: [script],
    });
    await client.connect();
    clients[`client_${i}_${script}`] = client;
  }

  try {
    const chat = new CliChat(docClient, clients, claudeService);
    const cli = new CliApp(chat);
    await cli.initialize();
    await cli.run();
  } finally {
    for (const client of Object.values(clients)) {
      await client.cleanup();
    }
  }
}

main().catch((error) => {
  console.error(error);
  exit(1);
});
