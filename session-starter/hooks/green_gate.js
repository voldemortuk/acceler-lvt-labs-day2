import { spawnSync } from "child_process";

async function readInput() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}

async function main() {
  const input = await readInput();

  // A Stop hook already blocked once this turn — exit clean or this loops forever.
  if (input.stop_hook_active) {
    process.exit(0);
  }

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  const result = spawnSync("npm run typecheck && npm test", {
    cwd: projectDir,
    shell: true,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    console.error(
      `green_gate: \`npm run typecheck && npm test\` is red — fix the failures before stopping.\n\n${output}`
    );
    process.exit(2);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(`green_gate hook error: ${err.message}`);
  process.exit(1);
});
