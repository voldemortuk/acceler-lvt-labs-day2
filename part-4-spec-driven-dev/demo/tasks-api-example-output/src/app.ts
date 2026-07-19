import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
  type Router,
} from "express";
import { createErrorMapper } from "./middleware/error-mapper.js";
import { NotFoundError } from "./errors.js";
import type { Logger } from "./logger.js";

export interface AppDeps {
  logger: Logger;
  /**
   * Task router mounted at /tasks. Pass an empty express.Router() in early
   * tests before task routes exist.
   */
  taskRouter: Router;
}

export function createApp(deps: AppDeps): Express {
  const { logger, taskRouter } = deps;
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  // request.ok logging (success path). Error responses are logged by
  // the error-mapper as `request.error`.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const started = Date.now();
    res.on("finish", () => {
      if (res.statusCode < 400) {
        const operation = (req as Request & { operation?: string }).operation;
        logger.log("request.ok", {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Date.now() - started,
          ...(operation ? { operation } : {}),
        });
      }
    });
    next();
  });

  app.use("/tasks", taskRouter);

  // Unmatched routes → not_found.
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError("route not found"));
  });

  app.use(createErrorMapper({ logger }));
  return app;
}
