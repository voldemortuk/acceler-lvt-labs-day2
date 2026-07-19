import { promises as fs } from "node:fs";
import { atomicWriteFile as defaultAtomicWriteFile } from "../lib/atomic-write.js";
import { StoreCorruptError, StoreWriteError } from "../errors.js";
import type { Logger } from "../logger.js";

export interface Task {
  id: string;
  title: string;
  dueDate: string | null;
  status: "open" | "complete";
  createdAt: string;
  completedAt: string | null;
}

export interface TaskStore {
  schemaVersion: 1;
  tasks: Task[];
}

export interface TaskRepository {
  load(): Promise<TaskStore>;
  saveAll(tasks: Task[]): Promise<void>;
}

export interface TaskRepositoryDeps {
  storePath: string;
  logger: Logger;
  /** Clock for testing quarantine file naming. */
  now?: () => Date;
  /** Injectable atomic-write for testability (default is the real helper). */
  atomicWriteFile?: (target: string, bytes: string | Buffer) => Promise<void>;
}

const CURRENT_SCHEMA_VERSION = 1 as const;

export function createTaskRepository(deps: TaskRepositoryDeps): TaskRepository {
  const { storePath, logger } = deps;
  const now = deps.now ?? (() => new Date());
  const atomicWriteFile = deps.atomicWriteFile ?? defaultAtomicWriteFile;

  // Single in-memory promise chain — serializes saveAll calls (FR-015).
  let writeChain: Promise<void> = Promise.resolve();

  async function load(): Promise<TaskStore> {
    let raw: string;
    try {
      raw = await fs.readFile(storePath, "utf8");
    } catch (err: unknown) {
      if (isEnoent(err)) {
        logger.log("store.initialized", { existed: false, path: storePath });
        return { schemaVersion: CURRENT_SCHEMA_VERSION, tasks: [] };
      }
      throw err;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw await quarantine("invalid JSON in store");
    }

    if (!isValidStore(parsed)) {
      throw await quarantine("store shape or schemaVersion is invalid");
    }

    logger.log("store.loaded", {
      existed: true,
      count: parsed.tasks.length,
      path: storePath,
    });
    return parsed;
  }

  async function saveAll(tasks: Task[]): Promise<void> {
    const store: TaskStore = { schemaVersion: CURRENT_SCHEMA_VERSION, tasks };
    const bytes = JSON.stringify(store, null, 2);

    // Chain writes so they never interleave.
    const prev = writeChain;
    const next = prev.then(async () => {
      try {
        await atomicWriteFile(storePath, bytes);
        logger.log("store.write", {
          outcome: "success",
          count: tasks.length,
          path: storePath,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.log("store.write", {
          outcome: "error",
          errorClass: err instanceof Error ? err.name : "Unknown",
          message,
          path: storePath,
        });
        throw new StoreWriteError(message);
      }
    });
    // Don't propagate rejections into the chain — otherwise a single failed
    // write would poison every future saveAll.
    writeChain = next.catch(() => undefined);
    await next;
  }

  async function quarantine(reason: string): Promise<StoreCorruptError> {
    const stamp = now().toISOString().replace(/[:.]/g, "-");
    const target = `${storePath}.corrupt.${stamp}`;
    try {
      await fs.rename(storePath, target);
      logger.log("store.quarantined", {
        reason,
        original: storePath,
        quarantined: target,
      });
      return new StoreCorruptError(reason, target);
    } catch (renameErr) {
      logger.log("store.quarantine_failed", {
        reason,
        original: storePath,
        message:
          renameErr instanceof Error ? renameErr.message : String(renameErr),
      });
      return new StoreCorruptError(reason, null);
    }
  }

  return { load, saveAll };
}

function isEnoent(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "ENOENT"
  );
}

function isValidStore(v: unknown): v is TaskStore {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  if (o.schemaVersion !== CURRENT_SCHEMA_VERSION) return false;
  if (!Array.isArray(o.tasks)) return false;
  return o.tasks.every(isValidTask);
}

function isValidTask(v: unknown): v is Task {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    (o.dueDate === null || typeof o.dueDate === "string") &&
    (o.status === "open" || o.status === "complete") &&
    typeof o.createdAt === "string" &&
    (o.completedAt === null || typeof o.completedAt === "string")
  );
}
