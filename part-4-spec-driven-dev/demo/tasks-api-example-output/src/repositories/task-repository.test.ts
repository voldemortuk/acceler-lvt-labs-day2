import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  createTaskRepository,
  type Task,
} from "./task-repository.js";
import { StoreCorruptError, StoreWriteError } from "../errors.js";
import { createLogger } from "../logger.js";

function makeLoggerCapture() {
  const lines: Record<string, unknown>[] = [];
  const logger = createLogger({
    write: (l) => lines.push(JSON.parse(l.trimEnd())),
  });
  return { logger, lines };
}

async function mkTmpDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "tr-"));
}

function sampleTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "T",
    dueDate: null,
    status: "open",
    createdAt: "2026-07-01T00:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

describe("task-repository", () => {
  let dir: string;
  let storePath: string;
  beforeEach(async () => {
    dir = await mkTmpDir();
    storePath = path.join(dir, "tasks.json");
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("load() on missing file returns empty store and logs store.initialized existed:false", async () => {
    const { logger, lines } = makeLoggerCapture();
    const repo = createTaskRepository({ storePath, logger });
    const store = await repo.load();
    expect(store).toEqual({ schemaVersion: 1, tasks: [] });
    expect(lines).toContainEqual(
      expect.objectContaining({
        event: "store.initialized",
        existed: false,
      })
    );
  });

  it("load() on valid file returns parsed contents and logs count:N", async () => {
    const t = sampleTask();
    await fs.writeFile(
      storePath,
      JSON.stringify({ schemaVersion: 1, tasks: [t] })
    );
    const { logger, lines } = makeLoggerCapture();
    const repo = createTaskRepository({ storePath, logger });
    const store = await repo.load();
    expect(store.tasks).toEqual([t]);
    expect(lines).toContainEqual(
      expect.objectContaining({
        event: "store.loaded",
        existed: true,
        count: 1,
      })
    );
  });

  it("load() on corrupt JSON throws StoreCorruptError and quarantines the file", async () => {
    await fs.writeFile(storePath, "{not json");
    const { logger, lines } = makeLoggerCapture();
    const now = new Date("2026-07-01T12:00:00.000Z");
    const repo = createTaskRepository({
      storePath,
      logger,
      now: () => now,
    });
    await expect(repo.load()).rejects.toBeInstanceOf(StoreCorruptError);
    // Original file has been renamed.
    await expect(fs.readFile(storePath, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    const entries = await fs.readdir(dir);
    const corrupt = entries.find((e) => e.startsWith("tasks.json.corrupt."));
    expect(corrupt).toBeDefined();
    expect(lines).toContainEqual(
      expect.objectContaining({ event: "store.quarantined" })
    );
  });

  it("load() on wrong schemaVersion also throws StoreCorruptError and quarantines (invariant 6)", async () => {
    await fs.writeFile(
      storePath,
      JSON.stringify({ schemaVersion: 2, tasks: [] })
    );
    const { logger } = makeLoggerCapture();
    const repo = createTaskRepository({ storePath, logger });
    await expect(repo.load()).rejects.toBeInstanceOf(StoreCorruptError);
    const entries = await fs.readdir(dir);
    expect(
      entries.some((e) => e.startsWith("tasks.json.corrupt."))
    ).toBe(true);
  });

  it("saveAll() writes via atomic-write helper and logs outcome:success", async () => {
    const spy = vi.fn(async (target: string, bytes: string | Buffer) => {
      // Cast: fs.writeFile's overloaded signature is awkward for a fake sink.
      await fs.writeFile(target, bytes as Parameters<typeof fs.writeFile>[1]);
    });
    const { logger, lines } = makeLoggerCapture();
    const repo = createTaskRepository({
      storePath,
      logger,
      atomicWriteFile: spy,
    });
    const t = sampleTask();
    await repo.saveAll([t]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(lines).toContainEqual(
      expect.objectContaining({
        event: "store.write",
        outcome: "success",
        count: 1,
      })
    );
    const roundTrip = JSON.parse(await fs.readFile(storePath, "utf8"));
    expect(roundTrip).toEqual({ schemaVersion: 1, tasks: [t] });
  });

  it("saveAll() failure logs outcome:error and throws StoreWriteError", async () => {
    const spy = vi.fn(async () => {
      throw new Error("disk full");
    });
    const { logger, lines } = makeLoggerCapture();
    const repo = createTaskRepository({
      storePath,
      logger,
      atomicWriteFile: spy,
    });
    await expect(repo.saveAll([])).rejects.toBeInstanceOf(StoreWriteError);
    expect(lines).toContainEqual(
      expect.objectContaining({
        event: "store.write",
        outcome: "error",
      })
    );
  });

  it("concurrent saveAll calls serialize (second write starts after first completes)", async () => {
    const events: string[] = [];
    const write = vi.fn(async (target: string, bytes: string | Buffer) => {
      const title = JSON.parse(bytes.toString()).tasks[0].title;
      events.push("start:" + title);
      await new Promise((r) => setTimeout(r, 20));
      events.push("end:" + title);
      // Cast: fs.writeFile's overloaded signature is awkward for a fake sink.
      await fs.writeFile(target, bytes as Parameters<typeof fs.writeFile>[1]);
    });
    const { logger } = makeLoggerCapture();
    const repo = createTaskRepository({
      storePath,
      logger,
      atomicWriteFile: write,
    });
    const p1 = repo.saveAll([sampleTask({ title: "A" })]);
    const p2 = repo.saveAll([sampleTask({ title: "B" })]);
    await Promise.all([p1, p2]);
    expect(events).toEqual(["start:A", "end:A", "start:B", "end:B"]);
  });

  it("chain survives a failed write — subsequent saveAll still runs", async () => {
    let call = 0;
    const write = vi.fn(async () => {
      call++;
      if (call === 1) throw new Error("first fails");
    });
    const { logger } = makeLoggerCapture();
    const repo = createTaskRepository({
      storePath,
      logger,
      atomicWriteFile: write,
    });
    await expect(repo.saveAll([])).rejects.toBeInstanceOf(StoreWriteError);
    await expect(repo.saveAll([])).resolves.toBeUndefined();
    expect(write).toHaveBeenCalledTimes(2);
  });
});
