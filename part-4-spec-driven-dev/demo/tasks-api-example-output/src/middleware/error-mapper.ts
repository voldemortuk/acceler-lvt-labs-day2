import type { ErrorRequestHandler, Request, Response, NextFunction } from "express";
import {
  AppError,
  NotFoundError,
  StoreCorruptError,
  StoreWriteError,
  ValidationError,
} from "../errors.js";
import type { Logger } from "../logger.js";

export interface ErrorMapperDeps {
  logger: Logger;
}

interface ErrorBody {
  error: "validation_error" | "not_found" | "internal_error";
  message: string;
  details?: { path: string; message: string }[];
}

function bodyFor(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof ValidationError) {
    const body: ErrorBody = {
      error: "validation_error",
      message: err.message,
    };
    if (err.details.length > 0) body.details = err.details;
    return { status: 400, body };
  }
  if (err instanceof NotFoundError) {
    return {
      status: 404,
      body: { error: "not_found", message: err.message },
    };
  }
  if (err instanceof StoreCorruptError) {
    return {
      status: 500,
      body: { error: "internal_error", message: "store is corrupt" },
    };
  }
  if (err instanceof StoreWriteError) {
    return {
      status: 500,
      body: { error: "internal_error", message: "write failed" },
    };
  }
  return {
    status: 500,
    body: { error: "internal_error", message: "unexpected error" },
  };
}

export function createErrorMapper(deps: ErrorMapperDeps): ErrorRequestHandler {
  const { logger } = deps;
  return function errorMapper(
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction
  ): void {
    const { status, body } = bodyFor(err);
    const operation = (req as Request & { operation?: string }).operation;
    if (err instanceof AppError) {
      logger.log("request.error", {
        method: req.method,
        path: req.path,
        status,
        errorClass: err.name,
        message: err.message,
        ...(operation ? { operation } : {}),
      });
    } else {
      logger.log("request.error", {
        method: req.method,
        path: req.path,
        status,
        errorClass: err instanceof Error ? err.name : "Unknown",
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        ...(operation ? { operation } : {}),
      });
    }
    res.status(status).json(body);
  };
}
