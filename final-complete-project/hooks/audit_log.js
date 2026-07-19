import fs from "fs";
import path from "path";

async function readInput() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}

function getFilePath(input) {
  const toolInput = input.tool_input || {};
  const toolResponse = input.tool_response || {};
  return toolInput.file_path ?? toolInput.path ?? toolResponse.filePath ?? null;
}

async function main() {
  const input = await readInput();

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const logPath = path.join(projectDir, ".claude", "hook-log.jsonl");

  const entry = {
    ts: new Date().toISOString(),
    tool_name: input.tool_name,
    file: getFilePath(input),
  };

  // fs.appendFileSync only ever adds bytes to the end of the file — it
  // never clears existing content the way a redirected `>` write would.
  fs.appendFileSync(logPath, JSON.stringify(entry) + "\n");

  process.exit(0);
}

main().catch((err) => {
  console.error(`audit_log hook error: ${err.message}`);
  process.exit(1);
});
