import path from "path";

// Standalone DML/DDL statement-starters, not generic words like FROM/WHERE
// that would false-positive on ordinary English prose/comments.
const SQL_KEYWORDS =
  /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|REPLACE|TRUNCATE)\b/i;

async function readInput() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}

function getIncomingText(toolName, toolInput) {
  if (toolName === "Write") {
    return toolInput.content ?? "";
  }
  if (toolName === "Edit") {
    return toolInput.new_string ?? "";
  }
  if (toolName === "MultiEdit") {
    const edits = toolInput.edits ?? [];
    return edits.map((edit) => edit.new_string ?? "").join("\n");
  }
  return "";
}

function isAllowedPath(relPath) {
  const normalized = relPath.split(path.sep).join("/");

  // DDL, not the query layer — a different concern (constitution.md §1).
  if (normalized === "src/schema.ts") return true;

  // The query layer itself.
  if (normalized === "src/queries" || normalized.startsWith("src/queries/")) {
    return true;
  }

  // Test fixtures — query modules stay pure reads (constitution.md §3), so
  // seed/fixture SQL for tests necessarily lives outside src/queries.
  if (normalized === "tests" || normalized.startsWith("tests/")) return true;
  if (/\.test\.ts$/.test(normalized)) return true;

  return false;
}

async function main() {
  const input = await readInput();
  const toolName = input.tool_name;
  const toolInput = input.tool_input || {};

  if (!["Write", "Edit", "MultiEdit"].includes(toolName)) {
    process.exit(0);
  }

  const filePath = toolInput.file_path;
  if (!filePath) {
    process.exit(0);
  }

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const relPath = path.relative(projectDir, path.resolve(filePath));

  if (isAllowedPath(relPath)) {
    process.exit(0);
  }

  const text = getIncomingText(toolName, toolInput);
  const match = text.match(SQL_KEYWORDS);

  if (match) {
    console.error(
      `Blocked: "${relPath}" is outside src/queries/ but its new content contains raw SQL (matched "${match[0]}").\n` +
        `Constitution §2 requires every SQL query to live in src/queries/. ` +
        `Allowed exceptions: src/schema.ts (DDL), and tests/** or *.test.ts (test fixtures).`
    );
    process.exit(2);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(`scope_guard hook error: ${err.message}`);
  process.exit(1);
});
