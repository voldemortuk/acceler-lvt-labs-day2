import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createLogger } from "../logger.js";
import { createTaskRepository } from "./task-repository.js";
import { createTaskService } from "../services/task-service.js";

/**
 * SC-006: 100 restart cycles preserve every acknowledged task.
 *
 * Each iteration constructs a fresh repository+service pair against the same
 * store file, adds a task, then discards the service instance — simulating a
 * process restart. On the next iteration the new service must observe every
 * previously acknowledged task.
 */
describe("restart-cycle (SC-006)", () => {
  let dir: string;
  let storePath: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "restart-"));
    storePath = path.join(dir, "tasks.json");
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("100 create-shutdown-reopen cycles preserve every task", async () => {
    const N = 100;
    const created: string[] = [];
    for (let i = 0; i < N; i++) {
      const logger = createLogger({ write: () => undefined });
      const repo = createTaskRepository({ storePath, logger });
      const svc = createTaskService({ repository: repo });
      const t = await svc.create({ title: `t${i}` });
      created.push(t.id);
      // Simulate shutdown: drop references.
    }

    const logger = createLogger({ write: () => undefined });
    const repo = createTaskRepository({ storePath, logger });
    const svc = createTaskService({ repository: repo });
    const items = await svc.list();
    expect(items).toHaveLength(N);
    const ids = new Set(items.map((t) => t.id));
    for (const id of created) expect(ids.has(id)).toBe(true);
  });
});
