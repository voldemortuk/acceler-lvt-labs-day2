import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createErrorMapper } from "./error-mapper.js";
import {
  NotFoundError,
  StoreCorruptError,
  StoreWriteError,
  ValidationError,
} from "../errors.js";
import { createLogger } from "../logger.js";

function makeApp(err: unknown) {
  const lines: string[] = [];
  const logger = createLogger({ write: (l) => lines.push(l) });
  const app = express();
  app.get("/boom", (_req, _res, next) => next(err));
  app.use(createErrorMapper({ logger }));
  return { app, lines };
}

describe("error-mapper middleware", () => {
  it("maps ValidationError → 400 with details", async () => {
    const err = new ValidationError("bad title", [
      { path: "title", message: "required" },
    ]);
    const { app, lines } = makeApp(err);
    const res = await request(app).get("/boom");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "validation_error",
      message: "bad title",
      details: [{ path: "title", message: "required" }],
    });
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.event).toBe("request.error");
    expect(parsed.errorClass).toBe("ValidationError");
  });

  it("maps ValidationError without details (omits details field)", async () => {
    const err = new ValidationError("bad");
    const { app } = makeApp(err);
    const res = await request(app).get("/boom");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "validation_error", message: "bad" });
    expect(res.body).not.toHaveProperty("details");
  });

  it("maps NotFoundError → 404", async () => {
    const { app } = makeApp(new NotFoundError("task not found"));
    const res = await request(app).get("/boom");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: "not_found",
      message: "task not found",
    });
  });

  it("maps StoreCorruptError → 500 store is corrupt", async () => {
    const { app } = makeApp(new StoreCorruptError("bad json"));
    const res = await request(app).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: "internal_error",
      message: "store is corrupt",
    });
  });

  it("maps StoreWriteError → 500 write failed", async () => {
    const { app } = makeApp(new StoreWriteError("EACCES"));
    const res = await request(app).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: "internal_error",
      message: "write failed",
    });
  });

  it("maps unknown Error → 500 unexpected error with stack in log", async () => {
    const { app, lines } = makeApp(new Error("boom"));
    const res = await request(app).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: "internal_error",
      message: "unexpected error",
    });
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.stack).toBeDefined();
  });
});
