import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createLogger } from "../logger.js";
import { createTaskRepository } from "../repositories/task-repository.js";
import { createTaskService } from "./task-service.js";

/**
 * SC-004: every operation completes in under 100 ms at a store size of
 * 1,000 tasks on a typical developer laptop. We assert p95 latency here.
 *
 * Skippable via CI_SKIP_PERF for known-slow CI hardware.
 */
const skip = process.env.CI_SKIP_PERF === "1";
const d = skip ? describe.skip : describe;

d("task-service perf (SC-004)", () => {
  let dir: string;
  let storePath: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "perf-"));
    storePath = path.join(dir, "tasks.json");
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  function p95(samples: number[]): number {
    const sorted = samples.slice().sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    return sorted[idx]!;
  }

  async function timeIt(fn: () => Promise<unknown>): Promise<number> {
    const t0 = performance.now();
    await fn();
    return performance.now() - t0;
  }

  it("p95(create) < 100 ms with 1,000 seeded tasks", async () => {
    const logger = createLogger({ write: () => undefined });
    const repo = createTaskRepository({ storePath, logger });
    const svc = createTaskService({ repository: repo });
    // Seed 1000 tasks (this is warm-up, not measured).
    for (let i = 0; i < 1000; i++) {
      await svc.create({ title: `seed-${i}` });
    }
    // Measure 100 more create operations.
    const samples: number[] = [];
    for (let i = 0; i < 100; i++) {
      samples.push(await timeIt(() => svc.create({ title: `m-${i}` })));
    }
    expect(p95(samples)).toBeLessThan(100);
  }, 30000);

  it("p95(list) < 100 ms at 1,000 tasks", async () => {
    const logger = createLogger({ write: () => undefined });
    const repo = createTaskRepository({ storePath, logger });
    const svc = createTaskService({ repository: repo });
    for (let i = 0; i < 1000; i++) {
      await svc.create({ title: `seed-${i}` });
    }
    const samples: number[] = [];
    for (let i = 0; i < 100; i++) {
      samples.push(await timeIt(() => svc.list()));
    }
    expect(p95(samples)).toBeLessThan(100);
  }, 30000);

  it("p95(complete) and p95(delete) < 100 ms at 1,000 tasks", async () => {
    const logger = createLogger({ write: () => undefined });
    const repo = createTaskRepository({ storePath, logger });
    const svc = createTaskService({ repository: repo });
    const ids: string[] = [];
    for (let i = 0; i < 1000; i++) {
      const t = await svc.create({ title: `seed-${i}` });
      ids.push(t.id);
    }
    // Complete 100.
    const cSamples: number[] = [];
    for (let i = 0; i < 100; i++) {
      cSamples.push(await timeIt(() => svc.complete(ids[i]!)));
    }
    // Delete 100.
    const dSamples: number[] = [];
    for (let i = 100; i < 200; i++) {
      dSamples.push(await timeIt(() => svc.remove(ids[i]!)));
    }
    expect(p95(cSamples)).toBeLessThan(100);
    expect(p95(dSamples)).toBeLessThan(100);
  }, 60000);
});
