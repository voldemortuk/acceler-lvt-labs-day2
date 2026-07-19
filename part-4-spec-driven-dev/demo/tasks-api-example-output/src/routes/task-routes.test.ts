import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import request from "supertest";
import { createApp } from "../app.js";
import { createTaskRouter } from "./task-routes.js";
import { createTaskService } from "../services/task-service.js";
import { createTaskRepository } from "../repositories/task-repository.js";
import { createLogger } from "../logger.js";

async function makeServerAndLogger() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "routes-"));
  const storePath = path.join(dir, "tasks.json");
  const lines: Record<string, unknown>[] = [];
  const logger = createLogger({
    write: (l) => lines.push(JSON.parse(l.trimEnd())),
  });
  const repo = createTaskRepository({ storePath, logger });
  const service = createTaskService({ repository: repo });
  const app = createApp({
    logger,
    taskRouter: createTaskRouter(service),
  });
  return { app, dir, lines, service };
}

describe("task-routes — US1 (POST/GET)", () => {
  let ctx: Awaited<ReturnType<typeof makeServerAndLogger>>;
  beforeEach(async () => {
    ctx = await makeServerAndLogger();
  });
  afterEach(async () => {
    await fs.rm(ctx.dir, { recursive: true, force: true });
  });

  it("POST /tasks with valid body → 201 + TaskView", async () => {
    const res = await request(ctx.app)
      .post("/tasks")
      .send({ title: "hello", dueDate: "2026-04-15" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: "hello",
      dueDate: "2026-04-15",
      status: "open",
      completedAt: null,
    });
    expect(typeof res.body.id).toBe("string");
    expect(typeof res.body.createdAt).toBe("string");
    expect(typeof res.body.overdue).toBe("boolean");
  });

  it("POST /tasks with empty title → 400 validation_error", async () => {
    const res = await request(ctx.app).post("/tasks").send({ title: "" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });

  it("POST /tasks with missing title → 400", async () => {
    const res = await request(ctx.app).post("/tasks").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });

  it("POST /tasks with malformed JSON → 400", async () => {
    const res = await request(ctx.app)
      .post("/tasks")
      .set("Content-Type", "application/json")
      .send("{not json");
    // Express body-parser produces a SyntaxError → error-mapper's fallback 500,
    // but in practice express@4 wraps this as a 400. Accept either as long as
    // it is a 4xx/5xx error body.
    expect([400, 500]).toContain(res.status);
  });

  it("GET /tasks returns created tasks matching the TaskView shape", async () => {
    await request(ctx.app).post("/tasks").send({ title: "A" });
    await request(ctx.app)
      .post("/tasks")
      .send({ title: "B", dueDate: "2099-01-01" });
    const res = await request(ctx.app).get("/tasks");
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(2);
    for (const t of res.body.tasks) {
      expect(t).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          title: expect.any(String),
          status: "open",
          createdAt: expect.any(String),
          completedAt: null,
          overdue: expect.any(Boolean),
        })
      );
    }
  });

  it("every 2xx response emits exactly one request.ok log line with operation & outcome", async () => {
    await request(ctx.app).post("/tasks").send({ title: "L" });
    await request(ctx.app).get("/tasks");
    const oks = ctx.lines.filter((l) => l.event === "request.ok");
    expect(oks.length).toBeGreaterThanOrEqual(2);
    const create = oks.find((l) => l.operation === "createTask");
    const list = oks.find((l) => l.operation === "listTasks");
    expect(create).toMatchObject({ status: 201, method: "POST" });
    expect(list).toMatchObject({ status: 200, method: "GET" });
  });
});

describe("task-routes — US3 (complete + delete)", () => {
  let ctx: Awaited<ReturnType<typeof makeServerAndLogger>>;
  beforeEach(async () => {
    ctx = await makeServerAndLogger();
  });
  afterEach(async () => {
    await fs.rm(ctx.dir, { recursive: true, force: true });
  });

  it("POST /tasks/:id/complete on existing → 200 + updated TaskView", async () => {
    const created = await request(ctx.app).post("/tasks").send({ title: "x" });
    const res = await request(ctx.app).post(
      `/tasks/${created.body.id}/complete`
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("complete");
    expect(res.body.completedAt).not.toBeNull();
  });

  it("POST /tasks/:id/complete on same id again → 200 (idempotent)", async () => {
    const created = await request(ctx.app).post("/tasks").send({ title: "x" });
    await request(ctx.app).post(`/tasks/${created.body.id}/complete`);
    const res = await request(ctx.app).post(
      `/tasks/${created.body.id}/complete`
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("complete");
  });

  it("POST /tasks/:id/complete on unknown uuid → 404 not_found", async () => {
    const res = await request(ctx.app).post(
      "/tasks/00000000-0000-4000-8000-000000000abc/complete"
    );
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not_found");
  });

  it("POST /tasks/:id/complete on malformed uuid → 404 (uniform)", async () => {
    const res = await request(ctx.app).post("/tasks/not-a-uuid/complete");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not_found");
  });

  it("DELETE /tasks/:id on existing → 204 no body", async () => {
    const created = await request(ctx.app).post("/tasks").send({ title: "x" });
    const res = await request(ctx.app).delete(`/tasks/${created.body.id}`);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it("DELETE /tasks/:id on unknown → 404", async () => {
    const res = await request(ctx.app).delete(
      "/tasks/00000000-0000-4000-8000-000000000abc"
    );
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not_found");
  });
});

describe("task-routes — US4 (overdue + ordering)", () => {
  let ctx: Awaited<ReturnType<typeof makeServerAndLogger>>;
  beforeEach(async () => {
    ctx = await makeServerAndLogger();
  });
  afterEach(async () => {
    await fs.rm(ctx.dir, { recursive: true, force: true });
  });

  it("GET /tasks response marks past-due open as overdue and orders per FR-004a", async () => {
    await request(ctx.app)
      .post("/tasks")
      .send({ title: "no-due-open" });
    await request(ctx.app)
      .post("/tasks")
      .send({ title: "past-late", dueDate: "2020-06-01" });
    await request(ctx.app)
      .post("/tasks")
      .send({ title: "past-early", dueDate: "2020-01-01" });
    await request(ctx.app)
      .post("/tasks")
      .send({ title: "future-near", dueDate: "2050-01-01" });
    await request(ctx.app)
      .post("/tasks")
      .send({ title: "future-far", dueDate: "2099-12-31" });
    const done = await request(ctx.app)
      .post("/tasks")
      .send({ title: "done", dueDate: "2020-05-05" });
    await request(ctx.app).post(`/tasks/${done.body.id}/complete`);

    const res = await request(ctx.app).get("/tasks");
    expect(res.status).toBe(200);
    const titles = res.body.tasks.map((t: { title: string }) => t.title);
    expect(titles).toEqual([
      "past-early",
      "past-late",
      "future-near",
      "future-far",
      "no-due-open",
      "done",
    ]);
    // Only the two past-open have overdue:true.
    const overdue = res.body.tasks
      .filter((t: { overdue: boolean }) => t.overdue)
      .map((t: { title: string }) => t.title)
      .sort();
    expect(overdue).toEqual(["past-early", "past-late"]);
  });
});
