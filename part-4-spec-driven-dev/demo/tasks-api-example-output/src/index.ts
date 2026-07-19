import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { createTaskRepository } from "./repositories/task-repository.js";
import { createTaskService } from "./services/task-service.js";
import { createTaskRouter } from "./routes/task-routes.js";
import { createApp } from "./app.js";
import { StoreCorruptError } from "./errors.js";

export function effectiveTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz.length > 0) return tz;
  } catch {
    /* fall through */
  }
  // Fallback: offset string like "UTC+02:00".
  const offsetMin = -new Date().getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

export async function bootstrap(): Promise<void> {
  const logger = createLogger();
  const config = loadConfig();
  const repository = createTaskRepository({
    storePath: config.storePath,
    logger,
  });

  try {
    await repository.load();
  } catch (err) {
    if (err instanceof StoreCorruptError) {
      logger.log("server.startup_failed", {
        reason: "store_corrupt",
        message: err.message,
        quarantined: err.quarantinedPath,
      });
      process.exit(3);
    }
    throw err;
  }

  const service = createTaskService({ repository });
  const app = createApp({
    logger,
    taskRouter: createTaskRouter(service),
  });

  const server = app.listen(config.port, () => {
    logger.log("server.started", {
      pid: process.pid,
      port: config.port,
      storePath: config.storePath,
      timezone: effectiveTimezone(),
    });
  });

  const shutdown = (signal: string) => {
    logger.log("server.stopping", { signal });
    server.close(() => {
      logger.log("server.stopped", {});
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// Run when executed directly (not when imported by tests).
const isDirectRun =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("index.ts") || process.argv[1].endsWith("index.js"));
if (isDirectRun) {
  bootstrap().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
